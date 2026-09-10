import { useCallback, useEffect, useState, type JSX } from 'react'
import {
  BarChart3,
  CalendarDays,
  ReceiptText,
  RotateCcw,
  TrendingUp
} from 'lucide-react'
import type {
  SalesReport,
  SalesReportRange
} from '../../../shared/contracts'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'

const labels = {
  fr: {
    eyebrow: 'Activité commerciale',
    title: 'Ventes',
    description: 'Suivez les ventes, les retours et les articles les plus vendus.',
    today: "Aujourd'hui",
    week: '7 jours',
    month: 'Ce mois',
    year: 'Cette année',
    netSales: 'Ventes nettes',
    afterReturns: 'Après déduction des retours',
    invoices: 'Factures',
    finalized: 'Documents finalisés',
    returns: 'Retours clients',
    refunded: 'Montants retournés',
    profit: 'Marge estimée',
    profitHelp: "Selon les prix d'achat actuels",
    activity: 'Activité par jour',
    date: 'Date',
    grossSales: 'Ventes',
    net: 'Net',
    topParts: 'Articles les plus vendus',
    part: 'Pièce',
    sold: 'Vendu',
    returned: 'Retourné',
    netQuantity: 'Qté nette',
    netAmount: 'Montant net',
    loading: 'Chargement des ventes…',
    empty: 'Aucune vente pour cette période.',
    retry: 'Réessayer'
  },
  en: {
    eyebrow: 'Sales activity',
    title: 'Sales',
    description: 'Track sales, returns and best-selling parts.',
    today: 'Today',
    week: '7 days',
    month: 'This month',
    year: 'This year',
    netSales: 'Net sales',
    afterReturns: 'After deducting returns',
    invoices: 'Invoices',
    finalized: 'Finalized documents',
    returns: 'Customer returns',
    refunded: 'Returned amounts',
    profit: 'Estimated profit',
    profitHelp: 'Based on current purchase prices',
    activity: 'Daily activity',
    date: 'Date',
    grossSales: 'Sales',
    net: 'Net',
    topParts: 'Best-selling parts',
    part: 'Part',
    sold: 'Sold',
    returned: 'Returned',
    netQuantity: 'Net qty.',
    netAmount: 'Net amount',
    loading: 'Loading sales…',
    empty: 'No sales for this period.',
    retry: 'Retry'
  },
  ar: {
    eyebrow: 'النشاط التجاري',
    title: 'المبيعات',
    description: 'متابعة المبيعات والمرتجعات والقطع الأكثر مبيعا.',
    today: 'اليوم',
    week: '7 أيام',
    month: 'هذا الشهر',
    year: 'هذه السنة',
    netSales: 'صافي المبيعات',
    afterReturns: 'بعد طرح المرتجعات',
    invoices: 'الفواتير',
    finalized: 'الفواتير المؤكدة',
    returns: 'مرتجعات الحرفاء',
    refunded: 'المبالغ المرجعة',
    profit: 'الربح التقديري',
    profitHelp: 'حسب أسعار الشراء الحالية',
    activity: 'النشاط حسب اليوم',
    date: 'التاريخ',
    grossSales: 'المبيعات',
    net: 'الصافي',
    topParts: 'القطع الأكثر مبيعا',
    part: 'القطعة',
    sold: 'المباع',
    returned: 'المرتجع',
    netQuantity: 'الكمية الصافية',
    netAmount: 'المبلغ الصافي',
    loading: 'جاري تحميل المبيعات…',
    empty: 'لا توجد مبيعات في هذه الفترة.',
    retry: 'إعادة المحاولة'
  }
} as const

export function Reports({ lang }: { lang: Language }): JSX.Element {
  const text = labels[lang]
  const [range, setRange] = useState<SalesReportRange>('month')
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (nextRange: SalesReportRange) => {
    try {
      setLoading(true)
      setError('')
      setReport(await window.desktop.reports.sales(nextRange))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.loading)
    } finally {
      setLoading(false)
    }
  }, [text.loading])

  useEffect(() => {
    void load(range)
  }, [range, load])

  const summary = report?.summary
  const locale = localeFor(lang)
  const ranges: Array<[SalesReportRange, string]> = [
    ['today', text.today],
    ['week', text.week],
    ['month', text.month],
    ['year', text.year]
  ]

  return (
    <div className="page reports-page">
      <section className="page-heading reports-heading">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
        <div className="report-range" aria-label={text.title}>
          {ranges.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={range === value ? 'active' : ''}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => void load(range)}>{text.retry}</button>
        </div>
      )}

      <section className="stats-grid report-stats">
        <article className="stat-card accent">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div>
            <span>{text.netSales}</span>
            <strong>{summary ? formatTnd(summary.netSalesTtcMillimes, locale) : '—'}</strong>
            <small>{text.afterReturns}</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><ReceiptText size={20} /></div>
          <div>
            <span>{text.invoices}</span>
            <strong>{summary?.invoiceCount ?? '—'}</strong>
            <small>{text.finalized}</small>
          </div>
        </article>
        <article className="stat-card warning">
          <div className="stat-icon"><RotateCcw size={20} /></div>
          <div>
            <span>{text.returns}</span>
            <strong>{summary ? formatTnd(summary.returnedTtcMillimes, locale) : '—'}</strong>
            <small>{text.refunded}</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><BarChart3 size={20} /></div>
          <div>
            <span>{text.profit}</span>
            <strong>{summary ? formatTnd(summary.estimatedProfitMillimes, locale) : '—'}</strong>
            <small>{text.profitHelp}</small>
          </div>
        </article>
      </section>

      <section className="reports-grid">
        <div className="panel">
          <div className="panel-heading">
            <div><h2>{text.activity}</h2><p>{text.afterReturns}</p></div>
            <CalendarDays size={18} />
          </div>
          {loading && !report ? (
            <div className="panel-empty">{text.loading}</div>
          ) : report && report.activity.length > 0 ? (
            <div className="table-wrap report-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.date}</th>
                    <th>{text.invoices}</th>
                    <th>{text.grossSales}</th>
                    <th>{text.returns}</th>
                    <th>{text.net}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.activity.map((row) => (
                    <tr key={row.date}>
                      <td><strong>{formatReportDate(row.date, locale)}</strong></td>
                      <td>{row.invoiceCount}</td>
                      <td>{formatTnd(row.salesTtcMillimes, locale)}</td>
                      <td>{formatTnd(row.returnedTtcMillimes, locale)}</td>
                      <td><strong>{formatTnd(row.netTtcMillimes, locale)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty">{text.empty}</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h2>{text.topParts}</h2><p>{text.netSales}</p></div>
            <BarChart3 size={18} />
          </div>
          {loading && !report ? (
            <div className="panel-empty">{text.loading}</div>
          ) : report && report.topParts.length > 0 ? (
            <div className="table-wrap report-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.part}</th>
                    <th>{text.sold}</th>
                    <th>{text.returned}</th>
                    <th>{text.netQuantity}</th>
                    <th>{text.netAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topParts.map((part) => (
                    <tr key={`${part.partId ?? 'manual'}-${part.reference}`}>
                      <td><strong>{part.designation}</strong><span>{part.reference}</span></td>
                      <td>{part.soldQuantity}</td>
                      <td>{part.returnedQuantity}</td>
                      <td><strong>{part.netQuantity}</strong></td>
                      <td><strong>{formatTnd(part.netSalesTtcMillimes, locale)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty">{text.empty}</div>
          )}
        </div>
      </section>
    </div>
  )
}

function formatReportDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`)
  )
}
