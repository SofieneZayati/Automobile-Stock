import { getDatabase } from '../database'
import type {
  SalesReport,
  SalesReportRange
} from '../../shared/contracts'

const startExpressions: Record<SalesReportRange, string> = {
  today: "date('now', 'localtime')",
  week: "date('now', 'localtime', '-6 days')",
  month: "date('now', 'localtime', 'start of month')",
  year: "date('now', 'localtime', 'start of year')"
}

export function getSalesReport(rangeValue: SalesReportRange): SalesReport {
  const range: SalesReportRange = Object.hasOwn(startExpressions, rangeValue)
    ? rangeValue
    : 'month'
  const start = startExpressions[range]
  const db = getDatabase()

  const sales = db.prepare(`
    SELECT
      COUNT(*) AS invoice_count,
      COALESCE(SUM(total_ttc_millimes), 0) AS gross_sales
    FROM invoices
    WHERE status = 'FINALIZED'
      AND date(finalized_at, 'localtime') >= ${start}
  `).get() as { invoice_count: number; gross_sales: number }

  const returned = db.prepare(`
    SELECT COALESCE(SUM(refund_ttc_millimes), 0) AS returned_total
    FROM invoice_returns
    WHERE date(created_at, 'localtime') >= ${start}
  `).get() as { returned_total: number }

  const saleProfit = Number((db.prepare(`
    SELECT COALESCE(SUM(
      il.line_ht_millimes - (COALESCE(p.purchase_price_millimes, 0) * il.quantity)
    ), 0) - (
      SELECT COALESCE(SUM(global_discount_ttc_millimes), 0)
      FROM invoices
      WHERE status = 'FINALIZED'
        AND date(finalized_at, 'localtime') >= ${start}
    ) AS estimated_profit
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN parts p ON p.id = il.part_id
    WHERE i.status = 'FINALIZED'
      AND date(i.finalized_at, 'localtime') >= ${start}
  `).get() as { estimated_profit: number }).estimated_profit)

  const returnedProfit = Number((db.prepare(`
    SELECT COALESCE(SUM(
      irl.line_ht_millimes - (COALESCE(p.purchase_price_millimes, 0) * irl.quantity)
    ), 0) - (
      SELECT COALESCE(SUM(global_discount_share_millimes), 0)
      FROM invoice_returns
      WHERE date(created_at, 'localtime') >= ${start}
    ) AS reversed_profit
    FROM invoice_return_lines irl
    JOIN invoice_returns ir ON ir.id = irl.return_id
    LEFT JOIN parts p ON p.id = irl.part_id
    WHERE date(ir.created_at, 'localtime') >= ${start}
  `).get() as { reversed_profit: number }).reversed_profit)

  const salesByDate = db.prepare(`
    SELECT
      date(finalized_at, 'localtime') AS activity_date,
      COUNT(*) AS invoice_count,
      COALESCE(SUM(total_ttc_millimes), 0) AS sales_total
    FROM invoices
    WHERE status = 'FINALIZED'
      AND date(finalized_at, 'localtime') >= ${start}
    GROUP BY activity_date
    ORDER BY activity_date DESC
  `).all() as Array<{
    activity_date: string
    invoice_count: number
    sales_total: number
  }>

  const returnsByDate = db.prepare(`
    SELECT
      date(created_at, 'localtime') AS activity_date,
      COALESCE(SUM(refund_ttc_millimes), 0) AS returned_total
    FROM invoice_returns
    WHERE date(created_at, 'localtime') >= ${start}
    GROUP BY activity_date
    ORDER BY activity_date DESC
  `).all() as Array<{
    activity_date: string
    returned_total: number
  }>

  const activityByDate = new Map<string, SalesReport['activity'][number]>()
  for (const row of salesByDate) {
    activityByDate.set(row.activity_date, {
      date: row.activity_date,
      invoiceCount: row.invoice_count,
      salesTtcMillimes: row.sales_total,
      returnedTtcMillimes: 0,
      netTtcMillimes: row.sales_total
    })
  }
  for (const row of returnsByDate) {
    const current = activityByDate.get(row.activity_date) ?? {
      date: row.activity_date,
      invoiceCount: 0,
      salesTtcMillimes: 0,
      returnedTtcMillimes: 0,
      netTtcMillimes: 0
    }
    current.returnedTtcMillimes = row.returned_total
    current.netTtcMillimes = current.salesTtcMillimes - row.returned_total
    activityByDate.set(row.activity_date, current)
  }

  const salesParts = db.prepare(`
    SELECT
      il.part_id, il.reference_snapshot, il.designation_snapshot,
      SUM(il.quantity) AS quantity,
      SUM(il.line_ttc_millimes) AS amount
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    WHERE i.status = 'FINALIZED'
      AND date(i.finalized_at, 'localtime') >= ${start}
    GROUP BY il.part_id, il.reference_snapshot, il.designation_snapshot
  `).all() as Array<{
    part_id: number | null
    reference_snapshot: string
    designation_snapshot: string
    quantity: number
    amount: number
  }>

  const returnedParts = db.prepare(`
    SELECT
      irl.part_id, irl.reference_snapshot, irl.designation_snapshot,
      SUM(irl.quantity) AS quantity,
      SUM(irl.line_ttc_millimes) AS amount
    FROM invoice_return_lines irl
    JOIN invoice_returns ir ON ir.id = irl.return_id
    WHERE date(ir.created_at, 'localtime') >= ${start}
    GROUP BY irl.part_id, irl.reference_snapshot, irl.designation_snapshot
  `).all() as Array<{
    part_id: number | null
    reference_snapshot: string
    designation_snapshot: string
    quantity: number
    amount: number
  }>

  const parts = new Map<string, SalesReport['topParts'][number]>()
  for (const row of salesParts) {
    const key = `${row.part_id ?? 'manual'}:${row.reference_snapshot}`
    parts.set(key, {
      partId: row.part_id,
      reference: row.reference_snapshot,
      designation: row.designation_snapshot,
      soldQuantity: row.quantity,
      returnedQuantity: 0,
      netQuantity: row.quantity,
      netSalesTtcMillimes: row.amount
    })
  }
  for (const row of returnedParts) {
    const key = `${row.part_id ?? 'manual'}:${row.reference_snapshot}`
    const current = parts.get(key) ?? {
      partId: row.part_id,
      reference: row.reference_snapshot,
      designation: row.designation_snapshot,
      soldQuantity: 0,
      returnedQuantity: 0,
      netQuantity: 0,
      netSalesTtcMillimes: 0
    }
    current.returnedQuantity += row.quantity
    current.netQuantity = current.soldQuantity - current.returnedQuantity
    current.netSalesTtcMillimes -= row.amount
    parts.set(key, current)
  }

  return {
    range,
    summary: {
      invoiceCount: sales.invoice_count,
      grossSalesTtcMillimes: sales.gross_sales,
      returnedTtcMillimes: returned.returned_total,
      netSalesTtcMillimes: sales.gross_sales - returned.returned_total,
      estimatedProfitMillimes: saleProfit - returnedProfit
    },
    activity: [...activityByDate.values()].sort((a, b) =>
      b.date.localeCompare(a.date)
    ),
    topParts: [...parts.values()]
      .sort((a, b) =>
        b.netQuantity - a.netQuantity
        || b.netSalesTtcMillimes - a.netSalesTtcMillimes
      )
      .slice(0, 20)
  }
}
