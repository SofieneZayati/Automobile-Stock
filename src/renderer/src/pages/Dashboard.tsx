import { useCallback, useEffect, useState, type JSX } from 'react'
import { AlertTriangle, ArrowUpRight, Boxes, FilePlus2, PackagePlus, ReceiptText, ShoppingCart } from 'lucide-react'
import { Language, localeFor, t, tr } from '../i18n'
import { formatTnd } from '../lib/money'
import { Page } from '../components/Sidebar'
import type { DashboardOverview } from '../../../shared/contracts'

type Props = {
  lang: Language
  onNavigate: (page: Page) => void
}

export function Dashboard({ lang, onNavigate }: Props): JSX.Element {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      setOverview(await window.desktop.dashboard.overview())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible de charger le tableau de bord.', 'Unable to load the dashboard.', 'تعذر تحميل لوحة التحكم.'))
    }
  }, [lang])

  useEffect(() => {
    void load()
  }, [load])

  const summary = overview?.summary

  return (
    <div className="page dashboard-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'full' }).format(new Date())}</span>
          <h1>{t(lang, 'overview')}</h1>
          <p>{tr(lang, "Votre activité, le stock et les factures importantes en un coup d'œil.", 'Your activity, stock and important invoices at a glance.', 'نشاطك والمخزون والفواتير المهمة في لمحة.')}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('invoices')}>
          <FilePlus2 size={19} />
          {t(lang, 'newInvoice')}
        </button>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => void load()}>{tr(lang, 'Réessayer', 'Try again', 'إعادة المحاولة')}</button></div>}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon"><Boxes size={20} /></div>
          <div><span>{tr(lang, 'Articles actifs', 'Active parts', 'القطع النشطة')}</span><strong>{summary?.activePartCount ?? '—'}</strong><small>{tr(lang, 'Catalogue du magasin', 'Shop catalogue', 'دليل المحل')}</small></div>
        </article>
        <article className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
          <div><span>{t(lang, 'lowStock')}</span><strong>{summary?.lowStockCount ?? '—'}</strong><small>{summary ? tr(lang, `${summary.outOfStockCount} rupture(s)`, `${summary.outOfStockCount} out of stock`, `${summary.outOfStockCount} غير متوفر`) : tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')}</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><ReceiptText size={20} /></div>
          <div><span>{tr(lang, "Factures aujourd'hui", "Today's invoices", 'فواتير اليوم')}</span><strong>{summary?.todayInvoiceCount ?? '—'}</strong><small>{tr(lang, 'Factures finalisées', 'Finalized invoices', 'الفواتير المؤكدة')}</small></div>
        </article>
        <article className="stat-card accent">
          <div className="stat-icon"><ShoppingCart size={20} /></div>
          <div><span>{tr(lang, "Ventes nettes aujourd'hui", "Today's net sales", 'صافي مبيعات اليوم')}</span><strong>{summary ? formatTnd(summary.todaySalesMillimes, localeFor(lang)) : '—'}</strong><small>{tr(lang, 'Retours déduits', 'Returns deducted', 'بعد طرح المرتجعات')}</small></div>
        </article>
      </section>

      <section className="quick-actions">
        <button type="button" onClick={() => onNavigate('invoices')}>
          <span className="quick-icon"><FilePlus2 size={21} /></span>
          <span><strong>{t(lang, 'newInvoice')}</strong><small>{tr(lang, 'Créer, vérifier et imprimer', 'Create, check and print', 'إنشاء ومراجعة وطباعة')}</small></span>
          <ArrowUpRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate('stock')}>
          <span className="quick-icon"><PackagePlus size={21} /></span>
          <span><strong>{t(lang, 'addPart')}</strong><small>{tr(lang, 'Référence, prix et emplacement', 'Reference, price and location', 'المرجع والسعر والمكان')}</small></span>
          <ArrowUpRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate('stock')}>
          <span className="quick-icon"><Boxes size={21} /></span>
          <span><strong>{t(lang, 'stockEntry')}</strong><small>{tr(lang, 'Réception ou correction', 'Receipt or adjustment', 'استلام أو تعديل')}</small></span>
          <ArrowUpRight size={18} />
        </button>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div><h2>{t(lang, 'lowStock')}</h2><p>{tr(lang, 'Articles sous leur seuil minimum.', 'Parts below their minimum level.', 'قطع تحت الحد الأدنى.')}</p></div>
            <button className="text-button" type="button" onClick={() => onNavigate('stock')}>{tr(lang, 'Voir tout', 'View all', 'عرض الكل')}</button>
          </div>
          {overview && overview.lowStockParts.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr><th>{tr(lang, 'Pièce', 'Part', 'القطعة')}</th><th>{tr(lang, 'Emplacement', 'Location', 'المكان')}</th><th>{tr(lang, 'Stock', 'Stock', 'المخزون')}</th></tr></thead>
                <tbody>
                  {overview.lowStockParts.map((part) => (
                    <tr key={part.id}>
                      <td><strong>{part.designation}</strong><span>{part.reference} · {part.vehicleCompatibility || tr(lang, 'Compatibilité non précisée', 'Compatibility not specified', 'التوافق غير محدد')}</span></td>
                      <td><span className="location-pill">{part.location || '—'}</span></td>
                      <td><span className="stock-danger">{part.quantity} {tr(lang, part.quantity > 1 ? 'unités' : 'unité', part.quantity === 1 ? 'unit' : 'units', 'وحدة')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty">{overview ? tr(lang, 'Aucun article sous le seuil.', 'No parts below the minimum level.', 'لا توجد قطع تحت الحد الأدنى.') : tr(lang, 'Chargement du stock…', 'Loading stock…', 'جار تحميل المخزون…')}</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h2>{t(lang, 'recentInvoices')}</h2><p>{tr(lang, 'Dernières opérations finalisées.', 'Latest finalized transactions.', 'آخر العمليات المؤكدة.')}</p></div>
            <button className="text-button" type="button" onClick={() => onNavigate('invoiceHistory')}>{tr(lang, 'Historique', 'History', 'السجل')}</button>
          </div>
          {overview && overview.recentInvoices.length > 0 ? (
            <div className="invoice-list">
              {overview.recentInvoices.map((invoice) => (
                <button className="invoice-row" type="button" key={invoice.id} onClick={() => onNavigate('invoiceHistory')}>
                  <span className="invoice-icon"><ReceiptText size={18} /></span>
                  <span className="invoice-main">
                    <strong>{invoice.number}</strong>
                    <small>{invoice.customerName} · {new Date(invoice.finalizedAt + 'Z').toLocaleString(localeFor(lang))}</small>
                  </span>
                  <span className="invoice-amount"><strong>{formatTnd(invoice.totalTtcMillimes, localeFor(lang))}</strong><small>{tr(lang, 'Finalisée', 'Finalized', 'مؤكدة')}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">{overview ? tr(lang, 'Aucune facture finalisée pour le moment.', 'No finalized invoices yet.', 'لا توجد فواتير مؤكدة حاليًا.') : tr(lang, 'Chargement des factures…', 'Loading invoices…', 'جار تحميل الفواتير…')}</div>
          )}
        </div>
      </section>
    </div>
  )
}
