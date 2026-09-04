import { getDatabase } from '../database'
import { inTransaction } from '../database/transaction'
import type {
  CreateInvoiceLineInput,
  FinalizedInvoice,
  FinalizedInvoiceLine,
  FinalizeInvoiceInput
} from '../../shared/contracts'

type CalculatedLine = FinalizedInvoiceLine & {
  partId: number | null
  discountPercent: number
}

export function finalizeInvoice(input: FinalizeInvoiceInput): FinalizedInvoice {
  const db = getDatabase()
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Invoice must contain at least one line')
  }

  const calculated = input.lines.map(calculateLine)
  const subtotalHtMillimes = calculated.reduce((sum, line) => sum + line.lineHtMillimes + line.discountMillimes, 0)
  const discountMillimes = calculated.reduce((sum, line) => sum + line.discountMillimes, 0)
  const taxMillimes = calculated.reduce((sum, line) => sum + line.taxMillimes, 0)
  const totalTtcMillimes = calculated.reduce((sum, line) => sum + line.lineTtcMillimes, 0)

  return inTransaction(db, () => {
    for (const line of calculated) {
      if (!line.partId) continue

      const stock = db.prepare('SELECT quantity, reference, designation FROM parts WHERE id = ? AND is_active = 1').get(line.partId) as {
        quantity: number
        reference: string
        designation: string
      } | undefined

      if (!stock) throw new Error(`Part not found for line ${line.reference}`)
      if (stock.quantity < line.quantity) {
        throw new Error(`Insufficient stock for ${stock.reference} — ${stock.designation}`)
      }
    }

    const number = nextInvoiceNumber()
    const customerName = cleanText(input.customerName) ?? 'Client comptoir'

    const invoiceResult = db.prepare(`
      INSERT INTO invoices(
        number, status, customer_name, customer_address, customer_tax_id,
        subtotal_ht_millimes, discount_millimes, tax_millimes, total_ttc_millimes,
        notes, finalized_at
      ) VALUES (?, 'FINALIZED', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      number,
      customerName,
      cleanText(input.customerAddress),
      cleanText(input.customerTaxId),
      subtotalHtMillimes,
      discountMillimes,
      taxMillimes,
      totalTtcMillimes,
      cleanText(input.notes)
    )

    const invoiceId = Number(invoiceResult.lastInsertRowid)

    const lineStmt = db.prepare(`
      INSERT INTO invoice_lines(
        invoice_id, part_id, reference_snapshot, designation_snapshot, quantity,
        unit_price_ht_millimes, discount_percent, discount_millimes, tax_percent,
        line_ht_millimes, tax_millimes, line_ttc_millimes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const stockUpdate = db.prepare(`
      UPDATE parts
      SET quantity = quantity - ?, updated_at = datetime('now')
      WHERE id = ? AND quantity >= ?
    `)

    const movementInsert = db.prepare(`
      INSERT INTO stock_movements(
        part_id, movement_type, quantity_delta, quantity_before, quantity_after, invoice_id, note
      ) VALUES (?, 'SALE', ?, ?, ?, ?, ?)
    `)

    for (const line of calculated) {
      lineStmt.run(
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

      if (line.partId) {
        const beforeRow = db.prepare('SELECT quantity FROM parts WHERE id = ?').get(line.partId) as { quantity: number }
        const before = beforeRow.quantity
        const result = stockUpdate.run(line.quantity, line.partId, line.quantity)
        if (result.changes !== 1) throw new Error(`Stock changed while finalizing ${line.reference}`)
        movementInsert.run(
          line.partId,
          -line.quantity,
          before,
          before - line.quantity,
          invoiceId,
          `Facture ${number}`
        )
      }
    }

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'FINALIZE', ?)
    `).run(invoiceId, JSON.stringify({ number, totalTtcMillimes, lineCount: calculated.length }))

    const finalized = getInvoice(invoiceId)
    if (!finalized) throw new Error('Finalized invoice could not be loaded')
    return finalized
  })
}

export function getInvoice(id: number): FinalizedInvoice | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const db = getDatabase()

  const invoice = db.prepare(`
    SELECT
      id, number, customer_name, customer_address, customer_tax_id, notes,
      finalized_at, subtotal_ht_millimes, discount_millimes, tax_millimes, total_ttc_millimes
    FROM invoices
    WHERE id = ? AND status = 'FINALIZED' AND number IS NOT NULL
  `).get(id) as {
    id: number
    number: string
    customer_name: string
    customer_address: string | null
    customer_tax_id: string | null
    notes: string | null
    finalized_at: string
    subtotal_ht_millimes: number
    discount_millimes: number
    tax_millimes: number
    total_ttc_millimes: number
  } | undefined

  if (!invoice) return null

  const rows = db.prepare(`
    SELECT
      reference_snapshot, designation_snapshot, quantity, unit_price_ht_millimes,
      discount_millimes, tax_percent, line_ht_millimes, tax_millimes, line_ttc_millimes
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
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerTaxId: invoice.customer_tax_id,
    notes: invoice.notes,
    finalizedAt: invoice.finalized_at,
    subtotalHtMillimes: invoice.subtotal_ht_millimes,
    discountMillimes: invoice.discount_millimes,
    taxMillimes: invoice.tax_millimes,
    totalTtcMillimes: invoice.total_ttc_millimes,
    lines: rows.map((row) => ({
      reference: row.reference_snapshot,
      designation: row.designation_snapshot,
      quantity: row.quantity,
      unitPriceHtMillimes: row.unit_price_ht_millimes,
      discountMillimes: row.discount_millimes,
      taxPercent: row.tax_percent,
      lineHtMillimes: row.line_ht_millimes,
      taxMillimes: row.tax_millimes,
      lineTtcMillimes: row.line_ttc_millimes
    }))
  }
}

function nextInvoiceNumber(): string {
  const db = getDatabase()
  const year = new Date().getFullYear()
  const prefix = `F-${year}-`

  const row = db.prepare(`
    SELECT number
    FROM invoices
    WHERE number LIKE ?
    ORDER BY number DESC
    LIMIT 1
  `).get(`${prefix}%`) as { number: string } | undefined

  const lastSequence = row ? Number.parseInt(row.number.slice(prefix.length), 10) || 0 : 0
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`
}

function calculateLine(input: CreateInvoiceLineInput): CalculatedLine {
  const reference = requireText(input.reference, 'reference')
  const designation = requireText(input.designation, 'designation')
  const quantity = requirePositiveInteger(input.quantity, 'quantity')
  const unitPrice = requireNonNegativeInteger(input.unitPriceHtMillimes, 'unitPriceHtMillimes')
  const discountPercent = requirePercentage(input.discountPercent ?? 0, 'discountPercent')
  const taxPercent = requirePercentage(input.taxPercent ?? 19, 'taxPercent')

  const gross = quantity * unitPrice
  const discountMillimes = Math.round((gross * discountPercent) / 100)
  const lineHtMillimes = gross - discountMillimes
  const taxMillimes = Math.round((lineHtMillimes * taxPercent) / 100)
  const lineTtcMillimes = lineHtMillimes + taxMillimes

  return {
    partId: input.partId && Number.isInteger(input.partId) && input.partId > 0 ? input.partId : null,
    reference,
    designation,
    quantity,
    unitPriceHtMillimes: unitPrice,
    discountPercent,
    discountMillimes,
    taxPercent,
    lineHtMillimes,
    taxMillimes,
    lineTtcMillimes
  }
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
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`)
  return value
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`)
  return value
}

function requirePercentage(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${field} must be between 0 and 100`)
  return value
}
