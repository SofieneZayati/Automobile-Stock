import { getDatabase } from '../database'
import { inTransaction } from '../database/transaction'
import type { AdjustStockInput, CreatePartInput, Part } from '../../shared/contracts'

type PartRow = {
  id: number
  reference: string
  designation: string
  oem_reference: string | null
  vehicle_compatibility: string | null
  category_id: number | null
  category_name: string | null
  supplier_id: number | null
  purchase_price_millimes: number
  sale_price_millimes: number
  quantity: number
  low_stock_threshold: number
  location: string | null
  notes: string | null
  is_active: number
  created_at: string
  updated_at: string
}

const partSelect = `
  SELECT
    p.id,
    p.reference,
    p.designation,
    p.oem_reference,
    p.vehicle_compatibility,
    p.category_id,
    c.name AS category_name,
    p.supplier_id,
    p.purchase_price_millimes,
    p.sale_price_millimes,
    p.quantity,
    p.low_stock_threshold,
    p.location,
    p.notes,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM parts p
  LEFT JOIN categories c ON c.id = p.category_id
`

export function listParts(query = ''): Part[] {
  const db = getDatabase()
  const needle = query.trim()

  const rows = needle
    ? db.prepare(`
        ${partSelect}
        WHERE p.is_active = 1
          AND (
            p.reference LIKE ? COLLATE NOCASE
            OR p.designation LIKE ? COLLATE NOCASE
            OR COALESCE(p.oem_reference, '') LIKE ? COLLATE NOCASE
            OR COALESCE(p.vehicle_compatibility, '') LIKE ? COLLATE NOCASE
            OR COALESCE(c.name, '') LIKE ? COLLATE NOCASE
            OR COALESCE(p.location, '') LIKE ? COLLATE NOCASE
          )
        ORDER BY p.designation COLLATE NOCASE, p.reference COLLATE NOCASE
        LIMIT 500
      `).all(...Array(6).fill(`%${needle}%`)) as PartRow[]
    : db.prepare(`
        ${partSelect}
        WHERE p.is_active = 1
        ORDER BY p.designation COLLATE NOCASE, p.reference COLLATE NOCASE
        LIMIT 500
      `).all() as PartRow[]

  return rows.map(mapPart)
}

export function getPart(id: number): Part | null {
  const row = getDatabase().prepare(`${partSelect} WHERE p.id = ?`).get(id) as PartRow | undefined
  return row ? mapPart(row) : null
}

export function createPart(input: CreatePartInput): Part {
  const db = getDatabase()
  const reference = requireText(input.reference, 'reference').toUpperCase()
  const designation = requireText(input.designation, 'designation')
  const salePrice = requireNonNegativeInteger(input.salePriceMillimes, 'salePriceMillimes')
  const purchasePrice = requireNonNegativeInteger(input.purchasePriceMillimes ?? 0, 'purchasePriceMillimes')
  const initialQuantity = requireNonNegativeInteger(input.initialQuantity ?? 0, 'initialQuantity')
  const threshold = requireNonNegativeInteger(input.lowStockThreshold ?? 0, 'lowStockThreshold')

  return inTransaction(db, () => {
    const categoryId = input.categoryName?.trim()
      ? ensureCategory(input.categoryName.trim())
      : null

    const result = db.prepare(`
      INSERT INTO parts(
        reference, designation, oem_reference, vehicle_compatibility, category_id,
        purchase_price_millimes, sale_price_millimes, quantity,
        low_stock_threshold, location, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reference,
      designation,
      optionalText(input.oemReference),
      optionalText(input.vehicleCompatibility),
      categoryId,
      purchasePrice,
      salePrice,
      initialQuantity,
      threshold,
      optionalText(input.location),
      optionalText(input.notes)
    )

    const partId = Number(result.lastInsertRowid)

    if (initialQuantity > 0) {
      db.prepare(`
        INSERT INTO stock_movements(
          part_id, movement_type, quantity_delta, quantity_before, quantity_after, note
        ) VALUES (?, 'INITIAL', ?, 0, ?, 'Stock initial')
      `).run(partId, initialQuantity, initialQuantity)
    }

    writeAudit('part', partId, 'CREATE', { reference, designation, initialQuantity })

    const created = getPart(partId)
    if (!created) throw new Error('Created part could not be loaded')
    return created
  })
}

export function adjustStock(input: AdjustStockInput): Part {
  const db = getDatabase()
  const partId = requirePositiveInteger(input.partId, 'partId')
  const delta = requireInteger(input.delta, 'delta')
  if (delta === 0) throw new Error('Stock adjustment cannot be zero')

  return inTransaction(db, () => {
    const current = db.prepare('SELECT quantity FROM parts WHERE id = ? AND is_active = 1').get(partId) as { quantity: number } | undefined
    if (!current) throw new Error('Part not found')

    const next = current.quantity + delta
    if (next < 0) throw new Error('Stock cannot become negative')

    db.prepare(`
      UPDATE parts
      SET quantity = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(next, partId)

    db.prepare(`
      INSERT INTO stock_movements(
        part_id, movement_type, quantity_delta, quantity_before, quantity_after, note
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(partId, input.reason, delta, current.quantity, next, optionalText(input.note))

    writeAudit('part', partId, 'STOCK_ADJUST', {
      delta,
      before: current.quantity,
      after: next,
      reason: input.reason
    })

    const updated = getPart(partId)
    if (!updated) throw new Error('Updated part could not be loaded')
    return updated
  })
}

export function getLowStockParts(limit = 8): Part[] {
  const rows = getDatabase().prepare(`
    ${partSelect}
    WHERE p.is_active = 1 AND p.quantity <= p.low_stock_threshold
    ORDER BY
      CASE WHEN p.quantity = 0 THEN 0 ELSE 1 END,
      (p.quantity - p.low_stock_threshold) ASC,
      p.designation COLLATE NOCASE
    LIMIT ?
  `).all(limit) as PartRow[]

  return rows.map(mapPart)
}

function ensureCategory(name: string): number {
  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)').run(name)
  const row = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(name) as { id: number } | undefined
  if (!row) throw new Error('Category could not be created')
  return row.id
}

function writeAudit(entityType: string, entityId: number, action: string, details: unknown): void {
  getDatabase().prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES (?, ?, ?, ?)
  `).run(entityType, entityId, action, JSON.stringify(details))
}

function mapPart(row: PartRow): Part {
  return {
    id: row.id,
    reference: row.reference,
    designation: row.designation,
    oemReference: row.oem_reference,
    vehicleCompatibility: row.vehicle_compatibility,
    categoryId: row.category_id,
    categoryName: row.category_name,
    supplierId: row.supplier_id,
    purchasePriceMillimes: row.purchase_price_millimes,
    salePriceMillimes: row.sale_price_millimes,
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    location: row.location,
    notes: row.notes,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`${field} is required`)
  return trimmed
}

function optionalText(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`)
  return value
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`)
  return value
}

function requireInteger(value: number, field: string): number {
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer`)
  return value
}
