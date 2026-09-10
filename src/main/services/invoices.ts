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
  InvoiceListItem,
  InvoiceReturn,
  ReturnInvoiceInput
} from '../../shared/contracts'

type CalculatedLine = Omit<
  FinalizedInvoiceLine,
  'invoiceLineId' | 'returnedQuantity' | 'returnableQuantity'
> & {
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
  phone: string | null
  address: string | null
  tax_id: string | null
} | null

type ResolvedCustomer = {
  name: string
  phone: string | null
  address: string | null
  taxId: string | null
}

export function finalizeInvoice(input: FinalizeInvoiceInput): FinalizedInvoice {
  const db = getDatabase()
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Ajoutez au moins une ligne avant de finaliser la facture.')
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

      if (!stock) throw new Error(`La pièce ${line.reference} n’est plus disponible dans le catalogue actif.`)
      if (stock.quantity < line.quantity) {
        throw new Error(
          `Stock insuffisant pour ${stock.reference} — ${stock.designation}. Disponible: ${stock.quantity}, demandé: ${line.quantity}.`
        )
      }
    }

    const number = nextInvoiceNumber(business)
    const selectedClient = resolveClient(input.clientId)
    const customer = resolveCustomer(input, business, selectedClient)
    const associatedClient = selectedClient
      ?? findOrCreateManualClient(customer, business, true)

    const invoiceResult = db.prepare(`
      INSERT INTO invoices(
        number, status, client_id, customer_name, customer_phone,
        customer_address, customer_tax_id,
        subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
        tax_millimes, total_ttc_millimes, notes, business_snapshot_json,
        updated_at, finalized_at
      ) VALUES (
        ?, 'FINALIZED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `).run(
      number,
      associatedClient?.id ?? null,
      customer.name,
      customer.phone,
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
        throw new Error(`Le stock de ${line.reference} a changé pendant la validation. Vérifiez la quantité et réessayez.`)
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
    if (!finalized) throw new Error('La facture finalisée n’a pas pu être rechargée.')
    return finalized
  })
}

export function saveInvoiceDraft(
  input: FinalizeInvoiceInput,
  draftId?: number
): InvoiceDraft {
  const db = getDatabase()
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Ajoutez au moins une ligne avant d’enregistrer le brouillon.')
  }

  const business = getBusinessSettings()
  const calculated = calculateInvoice(input, business)
  const selectedClient = resolveClient(input.clientId)
  const customer = resolveCustomer(input, business, selectedClient)

  return inTransaction(db, () => {
    const associatedClient = selectedClient
      ?? findOrCreateManualClient(customer, business, false)
    let id: number

    if (draftId !== undefined) {
      requireDraft(draftId)

      const result = db.prepare(`
        UPDATE invoices
        SET
          client_id = ?,
          customer_name = ?,
          customer_phone = ?,
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
        associatedClient?.id ?? null,
        customer.name,
        customer.phone,
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
        throw new Error('Le brouillon n’a pas pu être mis à jour.')
      }

      db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(draftId)
      id = draftId
    } else {
      const result = db.prepare(`
        INSERT INTO invoices(
          status, client_id, customer_name, customer_phone,
          customer_address, customer_tax_id,
          subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
          tax_millimes, total_ttc_millimes, notes, business_snapshot_json,
          updated_at
        ) VALUES (
          'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
      `).run(
        associatedClient?.id ?? null,
        customer.name,
        customer.phone,
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
    if (!saved) throw new Error('Le brouillon enregistré n’a pas pu être rechargé.')
    return saved
  })
}

export function getInvoiceDraft(id: number): InvoiceDraft | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const db = getDatabase()

  const invoice = db.prepare(`
    SELECT
      id, client_id, customer_name, customer_phone, customer_address,
      customer_tax_id, notes,
      created_at, COALESCE(updated_at, created_at) AS updated_at,
      subtotal_ht_millimes, discount_millimes, global_discount_ttc_millimes,
      tax_millimes, total_ttc_millimes, business_snapshot_json
    FROM invoices
    WHERE id = ? AND status = 'DRAFT'
  `).get(id) as {
    id: number
    client_id: number | null
    customer_name: string
    customer_phone: string | null
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
    customerPhone: invoice.customer_phone,
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
    throw new Error('La facture sélectionnée est invalide.')
  }

  const reason = reasonValue?.trim()
  if (!reason) {
    throw new Error('La raison de l’annulation est obligatoire.')
  }
  if (reason.length > 500) {
    throw new Error('La raison de l’annulation est trop longue.')
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

    if (!invoice) throw new Error('Facture introuvable.')
    if (invoice.status === 'CANCELLED') {
      throw new Error('Cette facture est déjà annulée.')
    }
    if (invoice.status !== 'FINALIZED') {
      throw new Error('Seule une facture finalisée peut être annulée.')
    }

    const existingReturns = Number((db.prepare(`
      SELECT COUNT(*) AS count FROM invoice_returns WHERE invoice_id = ?
    `).get(id) as { count: number }).count)
    if (existingReturns > 0) {
      throw new Error(
        'Cette facture contient déjà un retour. Utilisez Retour / échange pour les autres articles.'
      )
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
      throw new Error('Le statut de la facture a changé avant l’annulation. Rechargez l’historique et réessayez.')
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
          `La pièce ${line.reference_snapshot} est introuvable pendant l’annulation.`
        )
      }

      const after = current.quantity + line.quantity
      const restored = restorePart.run(line.quantity, line.part_id)
      if (restored.changes !== 1) {
        throw new Error(
          `Impossible de réintégrer le stock de ${line.reference_snapshot}.`
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
    if (!cancelled) throw new Error('La facture annulée n’a pas pu être rechargée.')
    return cancelled
  })
}

export function returnInvoiceItems(input: ReturnInvoiceInput): FinalizedInvoice {
  if (!Number.isInteger(input.invoiceId) || input.invoiceId <= 0) {
    throw new Error('La facture sélectionnée est invalide.')
  }

  const reason = input.reason?.trim()
  if (!reason) throw new Error('La raison du retour est obligatoire.')
  if (reason.length > 500) throw new Error('La raison du retour est trop longue.')
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('Sélectionnez au moins une pièce à retourner.')
  }

  const requested = new Map<number, number>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.invoiceLineId) || line.invoiceLineId <= 0) {
      throw new Error('Une ligne de retour est invalide.')
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('La quantité retournée doit être un nombre entier supérieur à zéro.')
    }
    if (requested.has(line.invoiceLineId)) {
      throw new Error('Une même ligne ne peut apparaître deux fois dans le retour.')
    }
    requested.set(line.invoiceLineId, line.quantity)
  }

  const db = getDatabase()

  return inTransaction(db, () => {
    const invoice = db.prepare(`
      SELECT
        id, number, status, global_discount_ttc_millimes,
        total_ttc_millimes
      FROM invoices
      WHERE id = ? AND number IS NOT NULL
    `).get(input.invoiceId) as {
      id: number
      number: string
      status: 'DRAFT' | 'FINALIZED' | 'CANCELLED'
      global_discount_ttc_millimes: number
      total_ttc_millimes: number
    } | undefined

    if (!invoice) throw new Error('Facture introuvable.')
    if (invoice.status !== 'FINALIZED') {
      throw new Error('Les retours sont possibles uniquement sur une facture finalisée.')
    }

    const soldLines = db.prepare(`
      SELECT
        il.id, il.part_id, il.reference_snapshot, il.designation_snapshot,
        il.quantity, il.line_ht_millimes, il.tax_millimes,
        il.line_ttc_millimes,
        COALESCE(SUM(irl.quantity), 0) AS returned_quantity
      FROM invoice_lines il
      LEFT JOIN invoice_return_lines irl ON irl.invoice_line_id = il.id
      WHERE il.invoice_id = ?
      GROUP BY il.id
      ORDER BY il.id
    `).all(invoice.id) as Array<{
      id: number
      part_id: number | null
      reference_snapshot: string
      designation_snapshot: string
      quantity: number
      line_ht_millimes: number
      tax_millimes: number
      line_ttc_millimes: number
      returned_quantity: number
    }>

    const calculatedLines = [...requested].map(([invoiceLineId, quantity]) => {
      const sold = soldLines.find((line) => line.id === invoiceLineId)
      if (!sold) throw new Error('Une pièce sélectionnée ne fait pas partie de cette facture.')

      const remaining = sold.quantity - sold.returned_quantity
      if (quantity > remaining) {
        throw new Error(
          `Retour trop élevé pour ${sold.reference_snapshot}. Maximum disponible: ${remaining}.`
        )
      }

      const afterQuantity = sold.returned_quantity + quantity
      const lineHtMillimes = cumulativeShare(
        sold.line_ht_millimes,
        afterQuantity,
        sold.quantity
      ) - cumulativeShare(
        sold.line_ht_millimes,
        sold.returned_quantity,
        sold.quantity
      )
      const taxMillimes = cumulativeShare(
        sold.tax_millimes,
        afterQuantity,
        sold.quantity
      ) - cumulativeShare(
        sold.tax_millimes,
        sold.returned_quantity,
        sold.quantity
      )
      const lineTtcMillimes = cumulativeShare(
        sold.line_ttc_millimes,
        afterQuantity,
        sold.quantity
      ) - cumulativeShare(
        sold.line_ttc_millimes,
        sold.returned_quantity,
        sold.quantity
      )

      return {
        sold,
        quantity,
        lineHtMillimes,
        taxMillimes,
        lineTtcMillimes
      }
    })

    const subtotalHtMillimes = calculatedLines.reduce(
      (sum, line) => sum + line.lineHtMillimes,
      0
    )
    const taxMillimes = calculatedLines.reduce(
      (sum, line) => sum + line.taxMillimes,
      0
    )
    const grossTtcMillimes = calculatedLines.reduce(
      (sum, line) => sum + line.lineTtcMillimes,
      0
    )
    const previousReturns = db.prepare(`
      SELECT
        COALESCE(SUM(gross_ttc_millimes), 0) AS gross_ttc,
        COALESCE(SUM(global_discount_share_millimes), 0) AS discount_share,
        COUNT(*) AS return_count
      FROM invoice_returns
      WHERE invoice_id = ?
    `).get(invoice.id) as {
      gross_ttc: number
      discount_share: number
      return_count: number
    }
    const totalBeforeGlobal =
      invoice.total_ttc_millimes + invoice.global_discount_ttc_millimes
    const cumulativeGross = previousReturns.gross_ttc + grossTtcMillimes
    const cumulativeDiscountShare = totalBeforeGlobal > 0
      ? Math.min(
          invoice.global_discount_ttc_millimes,
          Math.round(
            invoice.global_discount_ttc_millimes
            * cumulativeGross
            / totalBeforeGlobal
          )
        )
      : 0
    const globalDiscountShareMillimes = Math.max(
      0,
      cumulativeDiscountShare - previousReturns.discount_share
    )
    const refundTtcMillimes = Math.max(
      0,
      grossTtcMillimes - globalDiscountShareMillimes
    )
    const returnNumber = `RET-${invoice.number}-${String(
      previousReturns.return_count + 1
    ).padStart(2, '0')}`

    const returnResult = db.prepare(`
      INSERT INTO invoice_returns(
        invoice_id, number, reason, subtotal_ht_millimes, tax_millimes,
        gross_ttc_millimes, global_discount_share_millimes,
        refund_ttc_millimes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoice.id,
      returnNumber,
      reason,
      subtotalHtMillimes,
      taxMillimes,
      grossTtcMillimes,
      globalDiscountShareMillimes,
      refundTtcMillimes
    )
    const returnId = Number(returnResult.lastInsertRowid)

    const insertReturnLine = db.prepare(`
      INSERT INTO invoice_return_lines(
        return_id, invoice_line_id, part_id, reference_snapshot,
        designation_snapshot, quantity, line_ht_millimes,
        tax_millimes, line_ttc_millimes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const partQuantity = db.prepare('SELECT quantity FROM parts WHERE id = ?')
    const restorePart = db.prepare(`
      UPDATE parts
      SET quantity = quantity + ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    const movementInsert = db.prepare(`
      INSERT INTO stock_movements(
        part_id, movement_type, quantity_delta, quantity_before,
        quantity_after, invoice_id, note
      ) VALUES (?, 'RETURN', ?, ?, ?, ?, ?)
    `)

    for (const line of calculatedLines) {
      insertReturnLine.run(
        returnId,
        line.sold.id,
        line.sold.part_id,
        line.sold.reference_snapshot,
        line.sold.designation_snapshot,
        line.quantity,
        line.lineHtMillimes,
        line.taxMillimes,
        line.lineTtcMillimes
      )

      if (!line.sold.part_id) continue
      const current = partQuantity.get(line.sold.part_id) as {
        quantity: number
      } | undefined
      if (!current) {
        throw new Error(
          `La pièce ${line.sold.reference_snapshot} est introuvable pendant le retour.`
        )
      }
      const after = current.quantity + line.quantity
      if (restorePart.run(line.quantity, line.sold.part_id).changes !== 1) {
        throw new Error(`Impossible de réintégrer ${line.sold.reference_snapshot} au stock.`)
      }
      movementInsert.run(
        line.sold.part_id,
        line.quantity,
        current.quantity,
        after,
        invoice.id,
        `${returnNumber} — ${reason}`
      )
    }

    db.prepare(`
      INSERT INTO audit_log(entity_type, entity_id, action, details_json)
      VALUES ('invoice', ?, 'RETURN', ?)
    `).run(invoice.id, JSON.stringify({
      invoiceNumber: invoice.number,
      returnNumber,
      reason,
      refundTtcMillimes,
      quantities: calculatedLines.map((line) => ({
        invoiceLineId: line.sold.id,
        reference: line.sold.reference_snapshot,
        quantity: line.quantity
      }))
    }))

    const updated = getInvoice(invoice.id)
    if (!updated) throw new Error('La facture retournée n’a pas pu être rechargée.')
    return updated
  })
}

export function getInvoice(id: number): FinalizedInvoice | null {
  if (!Number.isInteger(id) || id <= 0) return null
  const db = getDatabase()

  const invoice = db.prepare(`
    SELECT
      id, number, status, client_id, customer_name, customer_address,
      customer_phone, customer_tax_id, notes, finalized_at, cancelled_at,
      cancellation_reason,
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
    customer_phone: string | null
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
      il.id, il.part_id, il.reference_snapshot, il.designation_snapshot,
      il.quantity, il.unit_price_ht_millimes, il.discount_millimes,
      il.tax_percent, il.line_ht_millimes, il.tax_millimes,
      il.line_ttc_millimes,
      COALESCE(SUM(irl.quantity), 0) AS returned_quantity
    FROM invoice_lines il
    LEFT JOIN invoice_return_lines irl ON irl.invoice_line_id = il.id
    WHERE il.invoice_id = ?
    GROUP BY il.id
    ORDER BY il.id
  `).all(id) as Array<{
    id: number
    part_id: number | null
    reference_snapshot: string
    designation_snapshot: string
    quantity: number
    unit_price_ht_millimes: number
    discount_millimes: number
    tax_percent: number
    line_ht_millimes: number
    tax_millimes: number
    line_ttc_millimes: number
    returned_quantity: number
  }>

  const returnRows = db.prepare(`
    SELECT
      id, number, reason, subtotal_ht_millimes, tax_millimes,
      gross_ttc_millimes, global_discount_share_millimes,
      refund_ttc_millimes, created_at
    FROM invoice_returns
    WHERE invoice_id = ?
    ORDER BY created_at, id
  `).all(id) as Array<{
    id: number
    number: string
    reason: string
    subtotal_ht_millimes: number
    tax_millimes: number
    gross_ttc_millimes: number
    global_discount_share_millimes: number
    refund_ttc_millimes: number
    created_at: string
  }>
  const returns = returnRows.map((row): InvoiceReturn => ({
    id: row.id,
    number: row.number,
    reason: row.reason,
    subtotalHtMillimes: row.subtotal_ht_millimes,
    taxMillimes: row.tax_millimes,
    grossTtcMillimes: row.gross_ttc_millimes,
    globalDiscountShareMillimes: row.global_discount_share_millimes,
    refundTtcMillimes: row.refund_ttc_millimes,
    createdAt: row.created_at,
    lines: (db.prepare(`
      SELECT
        id, invoice_line_id, part_id, reference_snapshot,
        designation_snapshot, quantity, line_ht_millimes,
        tax_millimes, line_ttc_millimes
      FROM invoice_return_lines
      WHERE return_id = ?
      ORDER BY id
    `).all(row.id) as Array<{
      id: number
      invoice_line_id: number
      part_id: number | null
      reference_snapshot: string
      designation_snapshot: string
      quantity: number
      line_ht_millimes: number
      tax_millimes: number
      line_ttc_millimes: number
    }>).map((line) => ({
      id: Number(line.id),
      invoiceLineId: Number(line.invoice_line_id),
      partId: line.part_id === null ? null : Number(line.part_id),
      reference: String(line.reference_snapshot),
      designation: String(line.designation_snapshot),
      quantity: Number(line.quantity),
      lineHtMillimes: Number(line.line_ht_millimes),
      taxMillimes: Number(line.tax_millimes),
      lineTtcMillimes: Number(line.line_ttc_millimes)
    }))
  }))
  const returnedTtcMillimes = returns.reduce(
    (sum, item) => sum + item.refundTtcMillimes,
    0
  )
  const returnStatus = rows.every(
    (row) => row.returned_quantity >= row.quantity
  ) && rows.length > 0
    ? 'FULL' as const
    : rows.some((row) => row.returned_quantity > 0)
      ? 'PARTIAL' as const
      : 'NONE' as const

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    clientId: invoice.client_id,
    customerName: invoice.customer_name,
    customerPhone: invoice.customer_phone,
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
    returnedTtcMillimes,
    netTtcMillimes: Math.max(0, invoice.total_ttc_millimes - returnedTtcMillimes),
    returnStatus,
    business: parseBusinessSnapshot(invoice.business_snapshot_json),
    lines: rows.map((row) => {
      const gross = row.unit_price_ht_millimes * row.quantity
      const net = gross - row.discount_millimes

      return {
        invoiceLineId: row.id,
        partId: row.part_id,
        reference: row.reference_snapshot,
        designation: row.designation_snapshot,
        quantity: row.quantity,
        unitPriceHtMillimes: row.unit_price_ht_millimes,
        netUnitPriceHtMillimes: Math.round(net / row.quantity),
        discountMillimes: row.discount_millimes,
        taxPercent: row.tax_percent,
        lineHtMillimes: row.line_ht_millimes,
        taxMillimes: row.tax_millimes,
        lineTtcMillimes: row.line_ttc_millimes,
        returnedQuantity: row.returned_quantity,
        returnableQuantity: Math.max(0, row.quantity - row.returned_quantity)
      }
    }),
    returns
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
      (SELECT COUNT(*) FROM invoice_lines il WHERE il.invoice_id = i.id) AS line_count,
      (SELECT COALESCE(SUM(il.quantity), 0) FROM invoice_lines il WHERE il.invoice_id = i.id) AS sold_quantity,
      (
        SELECT COALESCE(SUM(irl.quantity), 0)
        FROM invoice_return_lines irl
        JOIN invoice_lines il ON il.id = irl.invoice_line_id
        WHERE il.invoice_id = i.id
      ) AS returned_quantity,
      (SELECT COUNT(*) FROM invoice_returns ir WHERE ir.invoice_id = i.id) AS return_count,
      (
        SELECT COALESCE(SUM(ir.refund_ttc_millimes), 0)
        FROM invoice_returns ir
        WHERE ir.invoice_id = i.id
      ) AS returned_ttc_millimes
    FROM invoices i
    WHERE i.status IN ('FINALIZED', 'CANCELLED')
      AND i.number IS NOT NULL
      ${needle
        ? "AND (i.number LIKE ? COLLATE NOCASE OR i.customer_name LIKE ? COLLATE NOCASE)"
        : ""}
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
    sold_quantity: number
    returned_quantity: number
    return_count: number
    returned_ttc_millimes: number
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
    lineCount: row.line_count,
    returnCount: row.return_count,
    returnedTtcMillimes: row.returned_ttc_millimes,
    netTtcMillimes: Math.max(0, row.total_ttc_millimes - row.returned_ttc_millimes),
    returnStatus: row.returned_quantity <= 0
      ? 'NONE'
      : row.returned_quantity >= row.sold_quantity
        ? 'FULL'
        : 'PARTIAL'
  }))
}

export function listInvoicesByClient(
  clientIdValue: number
): InvoiceListItem[] {
  if (!Number.isInteger(clientIdValue) || clientIdValue <= 0) {
    throw new Error('Le client sélectionné est invalide.')
  }

  const rows = getDatabase().prepare(`
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
      (SELECT COUNT(*) FROM invoice_lines il WHERE il.invoice_id = i.id) AS line_count,
      (SELECT COALESCE(SUM(il.quantity), 0) FROM invoice_lines il WHERE il.invoice_id = i.id) AS sold_quantity,
      (
        SELECT COALESCE(SUM(irl.quantity), 0)
        FROM invoice_return_lines irl
        JOIN invoice_lines il ON il.id = irl.invoice_line_id
        WHERE il.invoice_id = i.id
      ) AS returned_quantity,
      (SELECT COUNT(*) FROM invoice_returns ir WHERE ir.invoice_id = i.id) AS return_count,
      (
        SELECT COALESCE(SUM(ir.refund_ttc_millimes), 0)
        FROM invoice_returns ir
        WHERE ir.invoice_id = i.id
      ) AS returned_ttc_millimes
    FROM invoices i
    WHERE i.client_id = ?
      AND i.status IN ('FINALIZED', 'CANCELLED')
      AND i.number IS NOT NULL
    ORDER BY i.finalized_at DESC, i.id DESC
    LIMIT 250
  `).all(clientIdValue) as Array<{
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
    sold_quantity: number
    returned_quantity: number
    return_count: number
    returned_ttc_millimes: number
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
    lineCount: row.line_count,
    returnCount: row.return_count,
    returnedTtcMillimes: row.returned_ttc_millimes,
    netTtcMillimes: Math.max(0, row.total_ttc_millimes - row.returned_ttc_millimes),
    returnStatus: row.returned_quantity <= 0
      ? 'NONE'
      : row.returned_quantity >= row.sold_quantity
        ? 'FULL'
        : 'PARTIAL'
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
    throw new Error('Le brouillon sélectionné est invalide.')
  }

  const row = getDatabase().prepare(
    "SELECT id FROM invoices WHERE id = ? AND status = 'DRAFT'"
  ).get(id)

  if (!row) throw new Error('Brouillon introuvable.')
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
): ResolvedCustomer {
  return {
    name:
      selectedClient?.name
      ?? cleanLimitedText(input.customerName, 120, 'Le nom du client')
      ?? business.defaultCustomerName,
    phone:
      selectedClient?.phone
      ?? cleanLimitedText(input.customerPhone, 40, 'Le téléphone du client'),
    address:
      selectedClient?.address
      ?? cleanLimitedText(input.customerAddress, 220, 'L’adresse du client'),
    taxId:
      selectedClient?.tax_id
      ?? cleanLimitedText(input.customerTaxId, 80, 'Le matricule fiscal du client')
  }
}

function resolveClient(clientId?: number): ResolvedClient {
  if (clientId === undefined || clientId === null) return null
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error('Le client sélectionné est invalide.')
  }

  const row = getDatabase().prepare(`
    SELECT id, name, phone, address, tax_id
    FROM clients
    WHERE id = ?
  `).get(clientId) as ResolvedClient | undefined

  if (!row) throw new Error('Client introuvable.')
  return row
}

function findOrCreateManualClient(
  customer: ResolvedCustomer,
  business: BusinessSettings,
  createIfMissing: boolean
): ResolvedClient {
  if (normalizeCustomerName(customer.name) === normalizeCustomerName(business.defaultCustomerName)) {
    return null
  }

  const db = getDatabase()
  const normalizedName = normalizeCustomerName(customer.name)
  const normalizedPhone = normalizeCustomerPhone(customer.phone)
  const clients = db.prepare(`
    SELECT id, name, phone, address, tax_id
    FROM clients
    ORDER BY id
  `).all() as Array<Exclude<ResolvedClient, null>>

  const sameNameClients = clients.filter(
    (client) => normalizeCustomerName(client.name) === normalizedName
  )
  const exactMatch = sameNameClients.find(
    (client) => normalizeCustomerPhone(client.phone) === normalizedPhone
  )
  const match = exactMatch ?? (
    sameNameClients.length === 1
    && (!normalizedPhone || !normalizeCustomerPhone(sameNameClients[0].phone))
      ? sameNameClients[0]
      : null
  )

  if (match) return completeMissingClientDetails(match, customer)
  if (!createIfMissing) return null

  const result = db.prepare(`
    INSERT INTO clients(name, phone, address, tax_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    customer.name,
    customer.phone,
    customer.address,
    customer.taxId,
    'Créé automatiquement lors de la facturation'
  )
  const id = Number(result.lastInsertRowid)

  db.prepare(`
    INSERT INTO audit_log(entity_type, entity_id, action, details_json)
    VALUES ('client', ?, 'CREATE_FROM_INVOICE', ?)
  `).run(id, JSON.stringify({
    name: customer.name,
    phone: customer.phone,
    taxId: customer.taxId
  }))

  return {
    id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    tax_id: customer.taxId
  }
}

function completeMissingClientDetails(
  client: Exclude<ResolvedClient, null>,
  customer: ResolvedCustomer
): Exclude<ResolvedClient, null> {
  const phone = client.phone ?? customer.phone
  const address = client.address ?? customer.address
  const taxId = client.tax_id ?? customer.taxId

  if (
    phone !== client.phone
    || address !== client.address
    || taxId !== client.tax_id
  ) {
    getDatabase().prepare(`
      UPDATE clients
      SET phone = ?, address = ?, tax_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(phone, address, taxId, client.id)
  }

  return {
    ...client,
    phone,
    address,
    tax_id: taxId
  }
}

function normalizeCustomerName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeCustomerPhone(value: string | null): string {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('00216')) digits = digits.slice(5)
  else if (digits.startsWith('216') && digits.length === 11) digits = digits.slice(3)
  return digits
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
      throw new Error('Le prix client ne peut pas dépasser le prix catalogue.')
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
    throw new Error('Choisissez soit un total final, soit une remise globale, pas les deux.')
  }

  if (hasTarget) {
    const target = requireNonNegativeInteger(
      input.targetTotalTtcMillimes as number,
      'targetTotalTtcMillimes'
    )
    if (target > totalBeforeDiscount) {
      throw new Error('Le total final demandé ne peut pas dépasser le total actuel de la facture.')
    }
    return totalBeforeDiscount - target
  }

  if (hasDiscount) {
    const discount = requireNonNegativeInteger(
      input.globalDiscountTtcMillimes as number,
      'globalDiscountTtcMillimes'
    )
    if (discount > totalBeforeDiscount) {
      throw new Error('La remise globale ne peut pas dépasser le total de la facture.')
    }
    return discount
  }

  return 0
}

function cumulativeShare(
  total: number,
  quantity: number,
  soldQuantity: number
): number {
  if (soldQuantity <= 0 || quantity <= 0) return 0
  if (quantity >= soldQuantity) return total
  return Math.round(total * quantity / soldQuantity)
}

function cleanText(value?: string): string | null {
  const text = value?.trim()
  return text ? text : null
}

function cleanLimitedText(
  value: string | undefined,
  maxLength: number,
  label: string
): string | null {
  const text = cleanText(value)
  if (text && text.length > maxLength) {
    throw new Error(`${label} est trop long.`)
  }
  return text
}

function requireText(value: string, field: string): string {
  const text = value?.trim()
  if (!text) {
    throw new Error(
      field === 'reference'
        ? 'La référence de la ligne est obligatoire.'
        : 'La désignation de la ligne est obligatoire.'
    )
  }

  if (text.length > (field === 'reference' ? 80 : 300)) {
    throw new Error(
      field === 'reference'
        ? 'La référence de la ligne est trop longue.'
        : 'La désignation de la ligne est trop longue.'
    )
  }

  return text
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      field === 'quantity'
        ? 'La quantité doit être un nombre entier supérieur à zéro.'
        : 'La valeur saisie doit être un nombre entier supérieur à zéro.'
    )
  }
  return value
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    const labels: Record<string, string> = {
      unitPriceHtMillimes: 'Le prix catalogue',
      negotiatedUnitPriceHtMillimes: 'Le prix client',
      targetTotalTtcMillimes: 'Le total final',
      globalDiscountTtcMillimes: 'La remise globale'
    }
    throw new Error(
      `${labels[field] ?? 'La valeur'} doit être un montant positif ou nul.`
    )
  }
  return value
}

function requirePercentage(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      field === 'taxPercent'
        ? 'Le taux de TVA doit être compris entre 0 et 100 %.'
        : 'La remise en pourcentage doit être comprise entre 0 et 100 %.'
    )
  }
  return value
}
