import { getDatabase } from '../database'
import { getLowStockParts } from '../repositories/parts'
import type { DashboardOverview, RecentInvoice } from '../../shared/contracts'

export function getDashboardOverview(): DashboardOverview {
  const db = getDatabase()

  const parts = db.prepare(`
    SELECT
      COUNT(*) AS active_count,
      SUM(CASE WHEN quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low_count,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_count
    FROM parts
    WHERE is_active = 1
  `).get() as {
    active_count: number
    low_count: number | null
    out_count: number | null
  }

  const sales = db.prepare(`
    SELECT
      COUNT(*) AS invoice_count,
      COALESCE(SUM(total_ttc_millimes), 0) AS sales_total
    FROM invoices
    WHERE status = 'FINALIZED'
      AND date(finalized_at, 'localtime') = date('now', 'localtime')
  `).get() as { invoice_count: number; sales_total: number }

  const invoiceRows = db.prepare(`
    SELECT id, number, customer_name, finalized_at, total_ttc_millimes
    FROM invoices
    WHERE status = 'FINALIZED' AND number IS NOT NULL
    ORDER BY finalized_at DESC, id DESC
    LIMIT 5
  `).all() as Array<{
    id: number
    number: string
    customer_name: string
    finalized_at: string
    total_ttc_millimes: number
  }>

  const recentInvoices: RecentInvoice[] = invoiceRows.map((row) => ({
    id: row.id,
    number: row.number,
    customerName: row.customer_name,
    finalizedAt: row.finalized_at,
    totalTtcMillimes: row.total_ttc_millimes
  }))

  return {
    summary: {
      activePartCount: parts.active_count,
      lowStockCount: parts.low_count ?? 0,
      outOfStockCount: parts.out_count ?? 0,
      todayInvoiceCount: sales.invoice_count,
      todaySalesMillimes: sales.sales_total
    },
    lowStockParts: getLowStockParts(),
    recentInvoices
  }
}
