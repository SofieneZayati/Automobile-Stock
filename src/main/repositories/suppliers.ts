import { getDatabase } from '../database'
import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput
} from '../../shared/contracts'

export function listSuppliers(query = ''): Supplier[] {
  const db = getDatabase()
  const needle = query.trim()
  const params = needle
    ? [`%${needle}%`, `%${needle}%`, `%${needle}%`, `%${needle}%`]
    : []

  const rows = db.prepare(`
    SELECT id, name, phone, email, address, notes, created_at, updated_at
    FROM suppliers
    ${needle
      ? 'WHERE name LIKE ? COLLATE NOCASE OR phone LIKE ? COLLATE NOCASE OR email LIKE ? COLLATE NOCASE OR address LIKE ? COLLATE NOCASE'
      : ''}
    ORDER BY name COLLATE NOCASE, id
    LIMIT 500
  `).all(...params) as SupplierRow[]

  return rows.map(mapSupplier)
}

export function createSupplier(input: CreateSupplierInput): Supplier {
  const db = getDatabase()
  const name = requiredText(input.name, 'name')
  const phone = cleanText(input.phone)
  const email = cleanText(input.email)
  const address = cleanText(input.address)
  const notes = cleanText(input.notes)

  const result = db.prepare(`
    INSERT INTO suppliers(name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, email, address, notes)

  const id = Number(result.lastInsertRowid)

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('supplier', ?, 'CREATE', ?)
  `).run(id, JSON.stringify({ name, phone, email }))

  const supplier = getSupplier(id)
  if (!supplier) throw new Error('Created supplier could not be loaded')
  return supplier
}

export function updateSupplier(input: UpdateSupplierInput): Supplier {
  const db = getDatabase()
  if (!Number.isInteger(input.id) || input.id <= 0) {
    throw new Error('Invalid supplier id')
  }

  if (!getSupplier(input.id)) throw new Error('Supplier not found')

  const name = requiredText(input.name, 'name')
  const phone = cleanText(input.phone)
  const email = cleanText(input.email)
  const address = cleanText(input.address)
  const notes = cleanText(input.notes)

  const result = db.prepare(`
    UPDATE suppliers
    SET
      name = ?,
      phone = ?,
      email = ?,
      address = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, phone, email, address, notes, input.id)

  if (result.changes !== 1) throw new Error('Supplier could not be updated')

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('supplier', ?, 'UPDATE', ?)
  `).run(input.id, JSON.stringify({ name, phone, email }))

  const supplier = getSupplier(input.id)
  if (!supplier) throw new Error('Updated supplier could not be loaded')
  return supplier
}

function getSupplier(id: number): Supplier | null {
  const row = getDatabase().prepare(`
    SELECT id, name, phone, email, address, notes, created_at, updated_at
    FROM suppliers
    WHERE id = ?
  `).get(id) as SupplierRow | undefined

  return row ? mapSupplier(row) : null
}

type SupplierRow = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function cleanText(value?: string): string | null {
  const text = value?.trim()
  return text ? text.slice(0, 500) : null
}

function requiredText(value: string, field: string): string {
  const text = value?.trim()
  if (!text) throw new Error(`${field} is required`)
  return text.slice(0, 160)
}
