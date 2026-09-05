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
  InvoiceListItem
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

  const business = getBusinessSettings()
  const calculated = input.lines.map((line) =>
    calculateLine(line, business.defaultTaxPercent)
  )
  const subtotalHtMillimes = calculated.reduce(
    (sum, line) => sum + line.lineHtMillimes + line.discountMillimes,
    0
  )
  const discountMillimes = calculated.reduce(
    (sum, line) => sum + line.discountMillimes,
    0
  )
  const taxMillimes = calculated.reduce(
    (sum, line) => sum + line.taxMillimes,
    0
  )
  const totalBeforeGlobalDiscountTtcMillimes = calculated.reduce(
    (sum, line) => sum + line.lineTtcMillimes,
    0
  )
  const globalDiscountTtcMillimes = resolveGlobalDiscount(
    input,
    totalBeforeGlobalDiscountTtcMillimes
  )
  const totalTtcMillimes =
    totalBeforeGlobalDiscountTtcMillimes - globalDiscountTtcMillimes

  return inTransaction(db, () => {
    for (const line of calculated) {
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
    const customerName =
      selectedClient?.name
      ?? cleanText(input.customerName)
      ?? business.defaultCustomerName
    const customerAddress =
      selectedClient?.address
      ?? cleanText(input.customerAddress)
    const customerTaxId =
      selectedClient?.tax_id
      ?? cleanText(input.customerTaxId)

    const invoiceResult = db.prepare(`
      INSERT INTO invoices(
        number, status, client_id, customer_name, customer_address, customer_tax_id,
        subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
        tax_millimes, total_ttc_millimes, notes, business_snapshot_json,
        finalized_at
      ) VALUES (?, 'FINALIZED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      number,
      selectedClient?.id ?? null,
      customerName,
      customerAddress,
      customerTaxId,
      subtotalHtMillimes,
      discountMillimes,
      globalDiscountTtcMillimes,
      taxMillimes,
      totalTtcMillimes,
      cleanText(input.notes),
      JSON.stringify(business)
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
        part_id, movement_type, quantity_delta, quantity_before, quantity_after,
        invoice_id, note
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
    }

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'FINALIZE', ?)
    `).run(
      invoiceId,
      JSON.stringify({
        number,
        lineDiscountMillimes: discountMillimes,
        globalDiscountTtcMillimes,
        totalTtcMillimes,
        lineCount: calculated.length,
        defaultTaxPercent: business.defaultTaxPercent
      })
    )

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
      id, number, client_id, customer_name, customer_address, customer_tax_id, notes,
      finalized_at, subtotal_ht_millimes, discount_millimes,
      global_discount_ttc_millimes, tax_millimes, total_ttc_millimes,
      business_snapshot_json
    FROM invoices
    WHERE id = ? AND status = 'FINALIZED' AND number IS NOT NULL
  `).get(id) as {
    id: number
    number: string
    client_id: number | null
    customer_name: string
    customer_address: string | null
    customer_tax_id: string | null
    notes: string | null
    finalized_at: string
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
    clientId: invoice.client_id,
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerTaxId: invoice.customer_tax_id,
    notes: invoice.notes,
    finalizedAt: invoice.finalized_at,
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
      i.customer_name,
      i.finalized_at,
      i.subtotal_ht_millimes,
      i.tax_millimes,
      i.total_ttc_millimes,
      COUNT(il.id) AS line_count
    FROM invoices i
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.status = 'FINALIZED'
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
    customer_name: string
    finalized_at: string
    subtotal_ht_millimes: number
    tax_millimes: number
    total_ttc_millimes: number
    line_count: number
  }>

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    customerName: row.customer_name,
    finalizedAt: row.finalized_at,
    subtotalHtMillimes: row.subtotal_ht_millimes,
    taxMillimes: row.tax_millimes,
    totalTtcMillimes: row.total_ttc_millimes,
    lineCount: row.line_count
  }))
}

function resolveClient(clientId?: number): {
  id: number
  name: string
  address: string | null
  tax_id: string | null
} | null {
  if (clientId === undefined || clientId === null) return null
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error('Invalid client id')
  }

  const db = getDatabase()
  const row = db.prepare(`
    SELECT id, name, address, tax_id
    FROM clients
    WHERE id = ?
  `).get(clientId) as {
    id: number
    name: string
    address: string | null
    tax_id: string | null
  } | undefined

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
