import { useCallback, useEffect, useState, type JSX } from 'react'
import { AlertTriangle, ArrowUpRight, Boxes, FilePlus2, PackagePlus, ReceiptText, ShoppingCart } from 'lucide-react'
import { Language, localeFor, t } from '../i18n'
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
      setError(cause instanceof Error ? cause.message : 'Impossible de charger le tableau de bord.')
    }
  }, [])

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
          <p>Votre activité, le stock et les factures importantes en un coup d'œil.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('invoices')}>
          <FilePlus2 size={19} />
          {t(lang, 'newInvoice')}
        </button>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => void load()}>Réessayer</button></div>}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon"><Boxes size={20} /></div>
          <div><span>Articles actifs</span><strong>{summary?.activePartCount ?? '—'}</strong><small>Catalogue local</small></div>
        </article>
        <article className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
          <div><span>{t(lang, 'lowStock')}</span><strong>{summary?.lowStockCount ?? '—'}</strong><small>{summary ? `${summary.outOfStockCount} rupture(s)` : 'Chargement…'}</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><ReceiptText size={20} /></div>
          <div><span>Factures aujourd'hui</span><strong>{summary?.todayInvoiceCount ?? '—'}</strong><small>Factures finalisées</small></div>
        </article>
        <article className="stat-card accent">
          <div className="stat-icon"><ShoppingCart size={20} /></div>
          <div><span>Ventes aujourd'hui</span><strong>{summary ? formatTnd(summary.todaySalesMillimes, localeFor(lang)) : '—'}</strong><small>Données enregistrées localement</small></div>
        </article>
      </section>

      <section className="quick-actions">
        <button type="button" onClick={() => onNavigate('invoices')}>
          <span className="quick-icon"><FilePlus2 size={21} /></span>
          <span><strong>{t(lang, 'newInvoice')}</strong><small>Créer, vérifier et imprimer</small></span>
          <ArrowUpRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate('stock')}>
          <span className="quick-icon"><PackagePlus size={21} /></span>
          <span><strong>{t(lang, 'addPart')}</strong><small>Référence, prix et emplacement</small></span>
          <ArrowUpRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate('stock')}>
          <span className="quick-icon"><Boxes size={21} /></span>
          <span><strong>{t(lang, 'stockEntry')}</strong><small>Réception ou correction</small></span>
          <ArrowUpRight size={18} />
        </button>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div><h2>{t(lang, 'lowStock')}</h2><p>Articles sous leur seuil minimum.</p></div>
            <button className="text-button" type="button" onClick={() => onNavigate('stock')}>Voir tout</button>
          </div>
          {overview && overview.lowStockParts.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr><th>Pièce</th><th>Emplacement</th><th>Stock</th></tr></thead>
                <tbody>
                  {overview.lowStockParts.map((part) => (
                    <tr key={part.id}>
                      <td><strong>{part.designation}</strong><span>{part.reference} · {part.vehicleCompatibility || 'Compatibilité non précisée'}</span></td>
                      <td><span className="location-pill">{part.location || '—'}</span></td>
                      <td><span className="stock-danger">{part.quantity} unité{part.quantity > 1 ? 's' : ''}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-empty">{overview ? 'Aucun article sous le seuil.' : 'Chargement du stock…'}</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h2>{t(lang, 'recentInvoices')}</h2><p>Dernières opérations finalisées.</p></div>
            <button className="text-button" type="button" onClick={() => onNavigate('invoiceHistory')}>Historique</button>
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
                  <span className="invoice-amount"><strong>{formatTnd(invoice.totalTtcMillimes, localeFor(lang))}</strong><small>Finalisée</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">{overview ? 'Aucune facture finalisée pour le moment.' : 'Chargement des factures…'}</div>
          )}
        </div>
      </section>
    </div>
  )
}
