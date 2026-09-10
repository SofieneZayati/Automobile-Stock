import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { getDatabase } from './database'
import { createPart, getPart } from './repositories/parts'
import { cancelInvoice, finalizeInvoice, returnInvoiceItems } from './services/invoices'
import { getSalesReport } from './services/sales'
import {
  createAutomaticBackup,
  getAutomaticBackupStatus
} from './services/backup'

export function runIntegrationTest(): void {
  const db = getDatabase()
  const migrations = db.prepare(
    'SELECT version FROM schema_migrations ORDER BY version'
  ).all() as Array<{ version: number }>
  assert.equal(migrations.at(-1)?.version, 8)
  const baselineClients = Number(
    (db.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }).count
  )
  const baselineInvoices = Number(
    (db.prepare("SELECT COUNT(*) AS count FROM invoices WHERE status = 'FINALIZED'").get() as { count: number }).count
  )
  const sofiene = db.prepare(`
    SELECT id, phone FROM clients WHERE name = 'Sofiene Zayati' COLLATE NOCASE
  `).get() as { id: number; phone: string | null } | undefined
  assert.ok(sofiene)

  const part = createPart({
    reference: 'TEST-CUSTOMER-LINK',
    designation: 'Pièce de test client/facture',
    salePriceMillimes: 12500,
    initialQuantity: 10,
    lowStockThreshold: 2
  })

  const line = {
    partId: part.id,
    reference: part.reference,
    designation: part.designation,
    quantity: 1,
    unitPriceHtMillimes: part.salePriceMillimes
  }

  const first = finalizeInvoice({
    customerName: 'Sofiène Zayati',
    customerPhone: '+216 22 333 444',
    customerAddress: 'Tunis',
    lines: [{ ...line, quantity: 2 }]
  })
  assert.ok(first.clientId)
  assert.equal(first.clientId, sofiene.id)
  assert.equal(first.customerPhone, '+216 22 333 444')
  assert.equal(
    (db.prepare('SELECT phone FROM clients WHERE id = ?').get(sofiene.id) as { phone: string }).phone,
    '+216 22 333 444'
  )

  const normalizedDuplicate = finalizeInvoice({
    customerName: '  SOFIENE   ZAYATI  ',
    customerPhone: '22.333.444',
    lines: [line]
  })
  assert.equal(normalizedDuplicate.clientId, first.clientId)
  assert.equal(normalizedDuplicate.customerPhone, '22.333.444')

  const sameNameDifferentPhone = finalizeInvoice({
    customerName: 'Sofiene Zayati',
    customerPhone: '55 666 777',
    lines: [line]
  })
  assert.notEqual(sameNameDifferentPhone.clientId, first.clientId)

  const walkIn = finalizeInvoice({ lines: [line] })
  assert.equal(walkIn.clientId, null)

  const returned = returnInvoiceItems({
    invoiceId: first.id,
    reason: 'Échange de référence',
    lines: [{
      invoiceLineId: first.lines[0].invoiceLineId,
      quantity: 1
    }]
  })
  assert.equal(returned.returnStatus, 'PARTIAL')
  assert.equal(returned.lines[0].returnedQuantity, 1)
  assert.equal(returned.lines[0].returnableQuantity, 1)
  assert.equal(returned.returns.length, 1)
  assert.equal(returned.returns[0].reason, 'Échange de référence')
  assert.ok(returned.returnedTtcMillimes > 0)
  assert.equal(
    (db.prepare('SELECT quantity FROM parts WHERE id = ?').get(part.id) as { quantity: number }).quantity,
    6
  )
  assert.throws(() => returnInvoiceItems({
    invoiceId: first.id,
    reason: 'Quantité trop élevée',
    lines: [{
      invoiceLineId: first.lines[0].invoiceLineId,
      quantity: 2
    }]
  }), /Maximum disponible/)

  const fullyReturned = returnInvoiceItems({
    invoiceId: first.id,
    reason: 'Retour du solde',
    lines: [{
      invoiceLineId: first.lines[0].invoiceLineId,
      quantity: 1
    }]
  })
  assert.equal(fullyReturned.returnStatus, 'FULL')
  assert.equal(fullyReturned.lines[0].returnableQuantity, 0)
  assert.equal(fullyReturned.returns.length, 2)
  assert.equal(
    (db.prepare('SELECT quantity FROM parts WHERE id = ?').get(part.id) as { quantity: number }).quantity,
    7
  )
  assert.throws(
    () => cancelInvoice(first.id, 'Annulation après retour'),
    /contient déjà un retour/
  )

  const sales = getSalesReport('month')
  assert.equal(sales.summary.invoiceCount, baselineInvoices + 4)
  assert.equal(sales.summary.returnedTtcMillimes, fullyReturned.returnedTtcMillimes)
  assert.ok(sales.activity.length > 0)
  assert.ok(sales.topParts.some((item) => item.partId === part.id))

  const automaticBackup = createAutomaticBackup()
  assert.ok(automaticBackup)
  assert.ok(existsSync(automaticBackup.path))
  assert.equal(createAutomaticBackup(), null)
  const automaticBackupStatus = getAutomaticBackupStatus()
  assert.equal(automaticBackupStatus.backupCount, 1)
  assert.equal(automaticBackupStatus.latestPath, automaticBackup.path)

  const counts = {
    clients: Number(
      (db.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }).count
    ),
    invoices: Number(
      (db.prepare("SELECT COUNT(*) AS count FROM invoices WHERE status = 'FINALIZED'").get() as { count: number }).count
    )
  }
  assert.deepEqual(counts, {
    clients: baselineClients + 1,
    invoices: baselineInvoices + 4
  })
  assert.equal(getPart(part.id)?.quantity, 7)
  assert.equal(
    (db.prepare('PRAGMA quick_check').get() as { quick_check: string }).quick_check,
    'ok'
  )

  console.log('Integration test passed:', JSON.stringify({
    migrations: migrations.length,
    ...counts,
    remainingStock: 7,
    duplicateClientId: first.clientId,
    returnNumber: fullyReturned.returns.at(-1)?.number,
    netSales: sales.summary.netSalesTtcMillimes,
    automaticBackups: automaticBackupStatus.backupCount
  }))
}
