import { AlertTriangle, ArrowUpRight, Boxes, FilePlus2, PackagePlus, ReceiptText, ShoppingCart } from 'lucide-react'
import { parts, recentInvoices } from '../data/mock'
import { Language, localeFor, t } from '../i18n'
import { formatTnd } from '../lib/money'
import { Page } from '../components/Sidebar'

type Props = {
  lang: Language
  onNavigate: (page: Page) => void
}

export function Dashboard({ lang, onNavigate }: Props): JSX.Element {
  const lowStock = parts.filter((part) => part.qty <= part.threshold)

  return (
    <div className="page dashboard-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Jeudi, 4 septembre 2026</span>
          <h1>{t(lang, 'overview')}</h1>
          <p>Votre activité, le stock et les factures importantes en un coup d'œil.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('invoices')}>
          <FilePlus2 size={19} />
          {t(lang, 'newInvoice')}
        </button>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon"><Boxes size={20} /></div>
          <div>
            <span>Articles actifs</span>
            <strong>1 284</strong>
            <small>32 catégories</small>
          </div>
        </article>
        <article className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
          <div>
            <span>{t(lang, 'lowStock')}</span>
            <strong>12</strong>
            <small>2 ruptures à traiter</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><ReceiptText size={20} /></div>
          <div>
            <span>Factures aujourd'hui</span>
            <strong>8</strong>
            <small>Dernière à 18:42</small>
          </div>
        </article>
        <article className="stat-card accent">
          <div className="stat-icon"><ShoppingCart size={20} /></div>
          <div>
            <span>Ventes aujourd'hui</span>
            <strong>{formatTnd(1248500, localeFor(lang))}</strong>
            <small>+11,4% vs. hier</small>
          </div>
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
            <div>
              <h2>{t(lang, 'lowStock')}</h2>
              <p>Articles sous leur seuil minimum.</p>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('stock')}>Voir tout</button>
          </div>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead><tr><th>Pièce</th><th>Emplacement</th><th>Stock</th><th></th></tr></thead>
              <tbody>
                {lowStock.map((part) => (
                  <tr key={part.id}>
                    <td><strong>{part.designation}</strong><span>{part.ref} · {part.vehicle}</span></td>
                    <td><span className="location-pill">{part.location}</span></td>
                    <td><span className="stock-danger">{part.qty} unité{part.qty > 1 ? 's' : ''}</span></td>
                    <td><button className="row-action" type="button">Réapprovisionner</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>{t(lang, 'recentInvoices')}</h2>
              <p>Dernières opérations finalisées.</p>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('invoices')}>Historique</button>
          </div>
          <div className="invoice-list">
            {recentInvoices.map((invoice) => (
              <button className="invoice-row" type="button" key={invoice.number}>
                <span className="invoice-icon"><ReceiptText size={18} /></span>
                <span className="invoice-main">
                  <strong>{invoice.number}</strong>
                  <small>{invoice.customer} · {invoice.date}</small>
                </span>
                <span className="invoice-amount">
                  <strong>{formatTnd(invoice.total, localeFor(lang))}</strong>
                  <small>{invoice.status}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
