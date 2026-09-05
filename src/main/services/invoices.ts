import { getDatabase } from '../database'
import { inTransaction } from '../database/transaction'
import {
  getBusinessSettings,
  normalizeBusinessSettings
} from './settings'
import type {
  BusinessSettings,
  CreateInvoiceLineInput,
  FinalizedInvoice,
  FinalizedInvoiceLine,
  FinalizeInvoiceInput,
  InvoiceDraft,
  InvoiceDraftLine,
  InvoiceDraftListItem,
  InvoiceListItem
} from '../../shared/contracts'

type CalculatedLine = FinalizedInvoiceLine & {
  partId: number | null
  discountPercent: number
}

type CalculatedInvoice = {
  lines: CalculatedLine[]
  subtotalHtMillimes: number
  discountMillimes: number
  taxMillimes: number
  totalBeforeGlobalDiscountTtcMillimes: number
  globalDiscountTtcMillimes: number
  totalTtcMillimes: number
}

type ResolvedClient = {
  id: number
  name: string
  address: string | null
  tax_id: string | null
} | null

export function finalizeInvoice(input: FinalizeInvoiceInput): FinalizedInvoice {
  const db = getDatabase()
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Invoice must contain at least one line')
  }

  const business = getBusinessSettings()
  const calculated = calculateInvoice(input, business)

  return inTransaction(db, () => {
    if (input.draftId !== undefined) {
      requireDraft(input.draftId)
    }

    for (const line of calculated.lines) {
      if (!line.partId) continue

      const stock = db.prepare(
        'SELECT quantity, reference, designation FROM parts WHERE id = ? AND is_active = 1'
      ).get(line.partId) as {
        quantity: number
        reference: string
        designation: string
      } | undefined

      if (!stock) throw new Error(`Part not found for line ${line.reference}`)
      if (stock.quantity < line.quantity) {
        throw new Error(
          `Insufficient stock for ${stock.reference} — ${stock.designation}`
        )
      }
    }

    const number = nextInvoiceNumber(business)
    const selectedClient = resolveClient(input.clientId)
    const customer = resolveCustomer(input, business, selectedClient)

    const invoiceResult = db.prepare(`
      INSERT INTO invoices(
        number, status, client_id, customer_name, customer_address, customer_tax_id,
        subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
        tax_millimes, total_ttc_millimes, notes, business_snapshot_json,
        updated_at, finalized_at
      ) VALUES (
        ?, 'FINALIZED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `).run(
      number,
      selectedClient?.id ?? null,
      customer.name,
      customer.address,
      customer.taxId,
      calculated.subtotalHtMillimes,
      calculated.discountMillimes,
      calculated.globalDiscountTtcMillimes,
      calculated.taxMillimes,
      calculated.totalTtcMillimes,
      cleanText(input.notes),
      JSON.stringify(business)
    )

    const invoiceId = Number(invoiceResult.lastInsertRowid)
    insertInvoiceLines(invoiceId, calculated.lines)

    const stockUpdate = db.prepare(`
      UPDATE parts
      SET quantity = quantity - ?, updated_at = datetime('now')
      WHERE id = ? AND quantity >= ?
    `)

    const movementInsert = db.prepare(`
      INSERT INTO stock_movements(
        part_id, movement_type, quantity_delta, quantity_before, quantity_after,
        invoice_id, note
      ) VALUES (?, 'SALE', ?, ?, ?, ?, ?)
    `)

    for (const line of calculated.lines) {
      if (!line.partId) continue

      const beforeRow = db.prepare(
        'SELECT quantity FROM parts WHERE id = ?'
      ).get(line.partId) as { quantity: number }
      const before = beforeRow.quantity
      const result = stockUpdate.run(
        line.quantity,
        line.partId,
        line.quantity
      )

      if (result.changes !== 1) {
        throw new Error(`Stock changed while finalizing ${line.reference}`)
      }

      movementInsert.run(
        line.partId,
        -line.quantity,
        before,
        before - line.quantity,
        invoiceId,
        `Facture ${number}`
      )
    }

    if (input.draftId !== undefined) {
      consumeDraft(input.draftId)
    }

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'FINALIZE', ?)
    `).run(
      invoiceId,
      JSON.stringify({
        number,
        sourceDraftId: input.draftId ?? null,
        lineDiscountMillimes: calculated.discountMillimes,
        globalDiscountTtcMillimes: calculated.globalDiscountTtcMillimes,
        totalTtcMillimes: calculated.totalTtcMillimes,
        lineCount: calculated.lines.length,
        defaultTaxPercent: business.defaultTaxPercent
      })
    )

    const finalized = getInvoice(invoiceId)
    if (!finalized) throw new Error('Finalized invoice could not be loaded')
    return finalized
  })
}

export function saveInvoiceDraft(
  input: FinalizeInvoiceInput,
  draftId?: number
): InvoiceDraft {
  const db = getDatabase()
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Draft must contain at least one line')
  }

  const business = getBusinessSettings()
  const calculated = calculateInvoice(input, business)
  const selectedClient = resolveClient(input.clientId)
  const customer = resolveCustomer(input, business, selectedClient)

  return inTransaction(db, () => {
    let id: number

    if (draftId !== undefined) {
      requireDraft(draftId)

      const result = db.prepare(`
        UPDATE invoices
        SET
          client_id = ?,
          customer_name = ?,
          customer_address = ?,
          customer_tax_id = ?,
          subtotal_ht_millimes = ?,
          discount_millimes = ?,
          global_discount_ttc_millimes = ?,
          tax_millimes = ?,
          total_ttc_millimes = ?,
          notes = ?,
          business_snapshot_json = ?,
          updated_at = datetime('now')
        WHERE id = ? AND status = 'DRAFT'
      `).run(
        selectedClient?.id ?? null,
        customer.name,
        customer.address,
        customer.taxId,
        calculated.subtotalHtMillimes,
        calculated.discountMillimes,
        calculated.globalDiscountTtcMillimes,
        calculated.taxMillimes,
        calculated.totalTtcMillimes,
        cleanText(input.notes),
        JSON.stringify(business),
        draftId
      )

      if (result.changes !== 1) {
        throw new Error('Draft could not be updated')
      }

      db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(draftId)
      id = draftId
    } else {
      const result = db.prepare(`
        INSERT INTO invoices(
          status, client_id, customer_name, customer_address, customer_tax_id,
          subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
          tax_millimes, total_ttc_millimes, notes, business_snapshot_json,
          updated_at
        ) VALUES (
          'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
      `).run(
        selectedClient?.id ?? null,
        customer.name,
        customer.address,
        customer.taxId,
        calculated.subtotalHtMillimes,
        calculated.discountMillimes,
        calculated.globalDiscountTtcMillimes,
        calculated.taxMillimes,
        calculated.totalTtcMillimes,
        cleanText(input.notes),
        JSON.stringify(business)
      )
      id = Number(result.lastInsertRowid)
    }

    insertInvoiceLines(id, calculated.lines)

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'SAVE_DRAFT', ?)
    `).run(
      id,
      JSON.stringify({
        lineCount: calculated.lines.length,
        totalTtcMillimes: calculated.totalTtcMillimes
      })
    )

    const saved = getInvoiceDraft(id)
    if (!saved) throw new Error('Saved draft could not be loaded')
    return saved
  })
}

export function getInvoiceDraft(id: number): InvoiceDraft | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const db = getDatabase()

  const invoice = db.prepare(`
    SELECT
      id, client_id, customer_name, customer_address, customer_tax_id, notes,
      created_at, COALESCE(updated_at, created_at) AS updated_at,
      subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
      tax_millimes, total_ttc_millimes, business_snapshot_json
    FROM invoices
    WHERE id = ? AND status = 'DRAFT'
  `).get(id) as {
    id: number
    client_id: number | null
    customer_name: string
    customer_address: string | null
    customer_tax_id: string | null
    notes: string | null
    created_at: string
    updated_at: string
    subtotal_ht_millimes: number
    discount_millimes: number
    global_discount_ttc_millimes: number
    tax_millimes: number
    total_ttc_millimes: number
    business_snapshot_json: string | null
  } | undefined

  if (!invoice) return null

  const rows = db.prepare(`
    SELECT
      il.part_id,
      il.reference_snapshot,
      il.designation_snapshot,
      il.quantity,
      il.unit_price_ht_millimes,
      il.discount_millimes,
      il.tax_percent,
      p.quantity AS current_stock,
      COALESCE(p.is_active, 0) AS current_part_active
    FROM invoice_lines il
    LEFT JOIN parts p ON p.id = il.part_id
    WHERE il.invoice_id = ?
    ORDER BY il.id
  `).all(id) as Array<{
    part_id: number | null
    reference_snapshot: string
    designation_snapshot: string
    quantity: number
    unit_price_ht_millimes: number
    discount_millimes: number
    tax_percent: number
    current_stock: number | null
    current_part_active: number
  }>

  return {
    id: invoice.id,
    clientId: invoice.client_id,
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerTaxId: invoice.customer_tax_id,
    notes: invoice.notes,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
    subtotalHtMillimes: invoice.subtotal_ht_millimes,
    discountMillimes: invoice.discount_millimes,
    globalDiscountTtcMillimes: invoice.global_discount_ttc_millimes,
    taxMillimes: invoice.tax_millimes,
    totalBeforeGlobalDiscountTtcMillimes:
      invoice.total_ttc_millimes + invoice.global_discount_ttc_millimes,
    totalTtcMillimes: invoice.total_ttc_millimes,
    business: parseBusinessSnapshot(invoice.business_snapshot_json),
    lines: rows.map(mapDraftLine)
  }
}

export function listInvoiceDrafts(): InvoiceDraftListItem[] {
  const rows = getDatabase().prepare(`
    SELECT
      i.id,
      i.customer_name,
      COALESCE(i.updated_at, i.created_at) AS updated_at,
      i.total_ttc_millimes,
      COUNT(il.id) AS line_count
    FROM invoices i
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.status = 'DRAFT'
    GROUP BY i.id
    ORDER BY COALESCE(i.updated_at, i.created_at) DESC, i.id DESC
    LIMIT 100
  `).all() as Array<{
    id: number
    customer_name: string
    updated_at: string
    total_ttc_millimes: number
    line_count: number
  }>

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    updatedAt: row.updated_at,
    totalTtcMillimes: row.total_ttc_millimes,
    lineCount: row.line_count
  }))
}

export function deleteInvoiceDraft(id: number): boolean {
  if (!Number.isInteger(id) || id <= 0) return false
  const db = getDatabase()

  return inTransaction(db, () => {
    const row = db.prepare(
      "SELECT id FROM invoices WHERE id = ? AND status = 'DRAFT'"
    ).get(id)
    if (!row) return false

    db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(id)
    const result = db.prepare(
      "DELETE FROM invoices WHERE id = ? AND status = 'DRAFT'"
    ).run(id)

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'DELETE_DRAFT', NULL)
    `).run(id)

    return result.changes === 1
  })
}

export function cancelInvoice(
  id: number,
  reasonValue: string
): FinalizedInvoice {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid invoice id')
  }

  const reason = reasonValue?.trim()
  if (!reason) {
    throw new Error('Cancellation reason is required')
  }
  if (reason.length > 500) {
    throw new Error('Cancellation reason is too long')
  }

  const db = getDatabase()

  return inTransaction(db, () => {
    const invoice = db.prepare(`
      SELECT id, number, status
      FROM invoices
      WHERE id = ? AND number IS NOT NULL
    `).get(id) as {
      id: number
      number: string
      status: 'DRAFT' | 'FINALIZED' | 'CANCELLED'
    } | undefined

    if (!invoice) throw new Error('Invoice not found')
    if (invoice.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled')
    }
    if (invoice.status !== 'FINALIZED') {
      throw new Error('Only finalized invoices can be cancelled')
    }

    const statusResult = db.prepare(`
      UPDATE invoices
      SET
        status = 'CANCELLED',
        cancelled_at = datetime('now'),
        cancellation_reason = ?,
        updated_at = datetime('now')
      WHERE id = ? AND status = 'FINALIZED'
    `).run(reason, id)

    if (statusResult.changes !== 1) {
      throw new Error('Invoice status changed before cancellation')
    }

    const lines = db.prepare(`
      SELECT part_id, quantity, reference_snapshot
      FROM invoice_lines
      WHERE invoice_id = ?
      ORDER BY id
    `).all(id) as Array<{
      part_id: number | null
      quantity: number
      reference_snapshot: string
    }>

    const partQuantity = db.prepare(
      'SELECT quantity FROM parts WHERE id = ?'
    )
    const restorePart = db.prepare(`
      UPDATE parts
      SET quantity = quantity + ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    const movementInsert = db.prepare(`
      INSERT INTO stock_movements(
        part_id, movement_type, quantity_delta, quantity_before, quantity_after,
        invoice_id, note
      ) VALUES (?, 'CANCELLATION', ?, ?, ?, ?, ?)
    `)

    for (const line of lines) {
      if (!line.part_id) continue

      const current = partQuantity.get(line.part_id) as {
        quantity: number
      } | undefined

      if (!current) {
        throw new Error(
          `Part missing while cancelling ${line.reference_snapshot}`
        )
      }

      const after = current.quantity + line.quantity
      const restored = restorePart.run(line.quantity, line.part_id)
      if (restored.changes !== 1) {
        throw new Error(
          `Could not restore stock for ${line.reference_snapshot}`
        )
      }

      movementInsert.run(
        line.part_id,
        line.quantity,
        current.quantity,
        after,
        id,
        `Annulation facture ${invoice.number} — ${reason}`
      )
    }

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'CANCEL', ?)
    `).run(
      id,
      JSON.stringify({
        number: invoice.number,
        reason,
        restoredLines: lines.filter((line) => line.part_id !== null).length
      })
    )

    const cancelled = getInvoice(id)
    if (!cancelled) throw new Error('Cancelled invoice could not be loaded')
    return cancelled
  })
}

export function getInvoice(id: number): FinalizedInvoice | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const db = getDatabase()

  const invoice = db.prepare(`
    SELECT
      id, number, status, client_id, customer_name, customer_address,
      customer_tax_id, notes, finalized_at, cancelled_at, cancellation_reason,
      subtotal_ht_millimes, discount_millimes,
      global_discount_ttc_millimes, tax_millimes, total_ttc_millimes,
      business_snapshot_json
    FROM invoices
    WHERE id = ?
      AND status IN ('FINALIZED', 'CANCELLED')
      AND number IS NOT NULL
  `).get(id) as {
    id: number
    number: string
    status: 'FINALIZED' | 'CANCELLED'
    client_id: number | null
    customer_name: string
    customer_address: string | null
    customer_tax_id: string | null
    notes: string | null
    finalized_at: string
    cancelled_at: string | null
    cancellation_reason: string | null
    subtotal_ht_millimes: number
    discount_millimes: number
    global_discount_ttc_millimes: number
    tax_millimes: number
    total_ttc_millimes: number
    business_snapshot_json: string | null
  } | undefined

  if (!invoice) return null

  const rows = db.prepare(`
    SELECT
      reference_snapshot, designation_snapshot, quantity, unit_price_ht_millimes,
      discount_millimes, tax_percent, line_ht_millimes, tax_millimes,
      line_ttc_millimes
    FROM invoice_lines
    WHERE invoice_id = ?
    ORDER BY id
  `).all(id) as Array<{
    reference_snapshot: string
    designation_snapshot: string
    quantity: number
    unit_price_ht_millimes: number
    discount_millimes: number
    tax_percent: number
    line_ht_millimes: number
    tax_millimes: number
    line_ttc_millimes: number
  }>

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    clientId: invoice.client_id,
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerTaxId: invoice.customer_tax_id,
    notes: invoice.notes,
    finalizedAt: invoice.finalized_at,
    cancelledAt: invoice.cancelled_at,
    cancellationReason: invoice.cancellation_reason,
    subtotalHtMillimes: invoice.subtotal_ht_millimes,
    discountMillimes: invoice.discount_millimes,
    globalDiscountTtcMillimes: invoice.global_discount_ttc_millimes,
    taxMillimes: invoice.tax_millimes,
    totalBeforeGlobalDiscountTtcMillimes:
      invoice.total_ttc_millimes + invoice.global_discount_ttc_millimes,
    totalTtcMillimes: invoice.total_ttc_millimes,
    business: parseBusinessSnapshot(invoice.business_snapshot_json),
    lines: rows.map((row) => {
      const gross = row.unit_price_ht_millimes * row.quantity
      const net = gross - row.discount_millimes

      return {
        reference: row.reference_snapshot,
        designation: row.designation_snapshot,
        quantity: row.quantity,
        unitPriceHtMillimes: row.unit_price_ht_millimes,
        netUnitPriceHtMillimes: Math.round(net / row.quantity),
        discountMillimes: row.discount_millimes,
        taxPercent: row.tax_percent,
        lineHtMillimes: row.line_ht_millimes,
        taxMillimes: row.tax_millimes,
        lineTtcMillimes: row.line_ttc_millimes
      }
    })
  }
}

export function listInvoices(query = ''): InvoiceListItem[] {
  const db = getDatabase()
  const needle = query.trim()
  const params = needle ? [`%${needle}%`, `%${needle}%`] : []

  const sql = `
    SELECT
      i.id,
      i.number,
      i.status,
      i.customer_name,
      i.finalized_at,
      i.cancelled_at,
      i.subtotal_ht_millimes,
      i.tax_millimes,
      i.total_ttc_millimes,
      COUNT(il.id) AS line_count
    FROM invoices i
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.status IN ('FINALIZED', 'CANCELLED')
      AND i.number IS NOT NULL
      ${needle
        ? "AND (i.number LIKE ? COLLATE NOCASE OR i.customer_name LIKE ? COLLATE NOCASE)"
        : ""}
    GROUP BY i.id
    ORDER BY i.finalized_at DESC, i.id DESC
    LIMIT 250
  `

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number
    number: string
    status: 'FINALIZED' | 'CANCELLED'
    customer_name: string
    finalized_at: string
    cancelled_at: string | null
    subtotal_ht_millimes: number
    tax_millimes: number
    total_ttc_millimes: number
    line_count: number
  }>

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    finalizedAt: row.finalized_at,
    cancelledAt: row.cancelled_at,
    subtotalHtMillimes: row.subtotal_ht_millimes,
    taxMillimes: row.tax_millimes,
    totalTtcMillimes: row.total_ttc_millimes,
    lineCount: row.line_count
  }))
}

function calculateInvoice(
  input: FinalizeInvoiceInput,
  business: BusinessSettings
): CalculatedInvoice {
  const lines = input.lines.map((line) =>
    calculateLine(line, business.defaultTaxPercent)
  )
  const subtotalHtMillimes = lines.reduce(
    (sum, line) => sum + line.lineHtMillimes + line.discountMillimes,
    0
  )
  const discountMillimes = lines.reduce(
    (sum, line) => sum + line.discountMillimes,
    0
  )
  const taxMillimes = lines.reduce(
    (sum, line) => sum + line.taxMillimes,
    0
  )
  const totalBeforeGlobalDiscountTtcMillimes = lines.reduce(
    (sum, line) => sum + line.lineTtcMillimes,
    0
  )
  const globalDiscountTtcMillimes = resolveGlobalDiscount(
    input,
    totalBeforeGlobalDiscountTtcMillimes
  )

  return {
    lines,
    subtotalHtMillimes,
    discountMillimes,
    taxMillimes,
    totalBeforeGlobalDiscountTtcMillimes,
    globalDiscountTtcMillimes,
    totalTtcMillimes:
      totalBeforeGlobalDiscountTtcMillimes - globalDiscountTtcMillimes
  }
}

function insertInvoiceLines(
  invoiceId: number,
  lines: CalculatedLine[]
): void {
  const stmt = getDatabase().prepare(`
    INSERT INTO invoice_lines(
      invoice_id, part_id, reference_snapshot, designation_snapshot, quantity,
      unit_price_ht_millimes, discount_percent, discount_millimes, tax_percent,
      line_ht_millimes, tax_millimes, line_ttc_millimes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const line of lines) {
    stmt.run(
      invoiceId,
      line.partId,
      line.reference,
      line.designation,
      line.quantity,
      line.unitPriceHtMillimes,
      line.discountPercent,
      line.discountMillimes,
      line.taxPercent,
      line.lineHtMillimes,
      line.taxMillimes,
      line.lineTtcMillimes
    )
  }
}

function mapDraftLine(row: {
  part_id: number | null
  reference_snapshot: string
  designation_snapshot: string
  quantity: number
  unit_price_ht_millimes: number
  discount_millimes: number
  tax_percent: number
  current_stock: number | null
  current_part_active: number
}): InvoiceDraftLine {
  const gross = row.unit_price_ht_millimes * row.quantity
  const net = gross - row.discount_millimes

  return {
    partId: row.part_id,
    reference: row.reference_snapshot,
    designation: row.designation_snapshot,
    quantity: row.quantity,
    unitPriceHtMillimes: row.unit_price_ht_millimes,
    negotiatedUnitPriceHtMillimes:
      Math.round(net / row.quantity),
    taxPercent: row.tax_percent,
    currentStock: row.current_stock,
    currentPartActive: row.current_part_active === 1
  }
}

function requireDraft(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid draft id')
  }

  const row = getDatabase().prepare(
    "SELECT id FROM invoices WHERE id = ? AND status = 'DRAFT'"
  ).get(id)

  if (!row) throw new Error('Draft not found')
}

function consumeDraft(id: number): void {
  requireDraft(id)
  const db = getDatabase()
  db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(id)
  db.prepare("DELETE FROM invoices WHERE id = ? AND status = 'DRAFT'").run(id)
}

function resolveCustomer(
  input: FinalizeInvoiceInput,
  business: BusinessSettings,
  selectedClient: ResolvedClient
): {
  name: string
  address: string | null
  taxId: string | null
} {
  return {
    name:
      selectedClient?.name
      ?? cleanText(input.customerName)
      ?? business.defaultCustomerName,
    address:
      selectedClient?.address
      ?? cleanText(input.customerAddress),
    taxId:
      selectedClient?.tax_id
      ?? cleanText(input.customerTaxId)
  }
}

function resolveClient(clientId?: number): ResolvedClient {
  if (clientId === undefined || clientId === null) return null
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error('Invalid client id')
  }

  const row = getDatabase().prepare(`
    SELECT id, name, address, tax_id
    FROM clients
    WHERE id = ?
  `).get(clientId) as ResolvedClient | undefined

  if (!row) throw new Error('Client not found')
  return row
}

function nextInvoiceNumber(settings: BusinessSettings): string {
  const db = getDatabase()
  const year = new Date().getFullYear()
  const prefix = `${settings.invoicePrefix}-${year}-`

  const row = db.prepare(`
    SELECT number
    FROM invoices
    WHERE number LIKE ?
    ORDER BY number DESC
    LIMIT 1
  `).get(`${prefix}%`) as { number: string } | undefined

  const lastSequence = row
    ? Number.parseInt(row.number.slice(prefix.length), 10) || 0
    : 0

  return `${prefix}${String(lastSequence + 1).padStart(
    settings.invoiceDigits,
    '0'
  )}`
}

function calculateLine(
  input: CreateInvoiceLineInput,
  defaultTaxPercent: number
): CalculatedLine {
  const reference = requireText(input.reference, 'reference')
  const designation = requireText(input.designation, 'designation')
  const quantity = requirePositiveInteger(input.quantity, 'quantity')
  const unitPrice = requireNonNegativeInteger(
    input.unitPriceHtMillimes,
    'unitPriceHtMillimes'
  )
  const taxPercent = requirePercentage(
    input.taxPercent ?? defaultTaxPercent,
    'taxPercent'
  )

  const gross = quantity * unitPrice
  let discountPercent = 0
  let discountMillimes = 0
  let lineHtMillimes = gross
  let netUnitPriceHtMillimes = unitPrice

  if (input.negotiatedUnitPriceHtMillimes !== undefined) {
    const negotiated = requireNonNegativeInteger(
      input.negotiatedUnitPriceHtMillimes,
      'negotiatedUnitPriceHtMillimes'
    )
    if (negotiated > unitPrice) {
      throw new Error('Negotiated unit price cannot exceed catalogue price')
    }

    netUnitPriceHtMillimes = negotiated
    lineHtMillimes = negotiated * quantity
    discountMillimes = gross - lineHtMillimes
    discountPercent = gross > 0 ? (discountMillimes / gross) * 100 : 0
  } else {
    discountPercent = requirePercentage(
      input.discountPercent ?? 0,
      'discountPercent'
    )
    discountMillimes = Math.round((gross * discountPercent) / 100)
    lineHtMillimes = gross - discountMillimes
    netUnitPriceHtMillimes =
      quantity > 0 ? Math.round(lineHtMillimes / quantity) : unitPrice
  }

  const taxMillimes = Math.round((lineHtMillimes * taxPercent) / 100)
  const lineTtcMillimes = lineHtMillimes + taxMillimes

  return {
    partId:
      input.partId && Number.isInteger(input.partId) && input.partId > 0
        ? input.partId
        : null,
    reference,
    designation,
    quantity,
    unitPriceHtMillimes: unitPrice,
    netUnitPriceHtMillimes,
    discountPercent,
    discountMillimes,
    taxPercent,
    lineHtMillimes,
    taxMillimes,
    lineTtcMillimes
  }
}

function parseBusinessSnapshot(value: string | null): BusinessSettings {
  if (!value) return getBusinessSettings()
  try {
    return normalizeBusinessSettings(JSON.parse(value))
  } catch {
    return getBusinessSettings()
  }
}

function resolveGlobalDiscount(
  input: FinalizeInvoiceInput,
  totalBeforeDiscount: number
): number {
  const hasTarget = input.targetTotalTtcMillimes !== undefined
  const hasDiscount = input.globalDiscountTtcMillimes !== undefined

  if (hasTarget && hasDiscount) {
    throw new Error('Use either a target total or a global discount, not both')
  }

  if (hasTarget) {
    const target = requireNonNegativeInteger(
      input.targetTotalTtcMillimes as number,
      'targetTotalTtcMillimes'
    )
    if (target > totalBeforeDiscount) {
      throw new Error('Target total cannot exceed the invoice total')
    }
    return totalBeforeDiscount - target
  }

  if (hasDiscount) {
    const discount = requireNonNegativeInteger(
      input.globalDiscountTtcMillimes as number,
      'globalDiscountTtcMillimes'
    )
    if (discount > totalBeforeDiscount) {
      throw new Error('Global discount cannot exceed the invoice total')
    }
    return discount
  }

  return 0
}

function cleanText(value?: string): string | null {
  const text = value?.trim()
  return text ? text : null
}

function requireText(value: string, field: string): string {
  const text = value?.trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return value
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`)
  }
  return value
}

function requirePercentage(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be between 0 and 100`)
  }
  return value
}
