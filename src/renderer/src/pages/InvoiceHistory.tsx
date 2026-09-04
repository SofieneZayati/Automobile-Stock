import { useCallback, useEffect, useState, type JSX } from 'react'
import { Eye, FilePlus2, ReceiptText, Search } from 'lucide-react'
import type { FinalizedInvoice, InvoiceListItem } from '../../../shared/contracts'
import type { Page } from '../components/Sidebar'
import { FinalizedInvoicePreview } from '../components/FinalizedInvoicePreview'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'

export function InvoiceHistory({ lang, onNavigate }: { lang: Language; onNavigate: (page: Page) => void }): JSX.Element {
  const [query, setQuery] = useState('')
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selected, setSelected] = useState<FinalizedInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (search: string) => {
    try {
      setLoading(true)
      setError('')
      setInvoices(await window.desktop.invoices.list(search))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les factures.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(query), 160)
    return () => window.clearTimeout(timeout)
  }, [query, load])

  async function openInvoice(id: number): Promise<void> {
    try {
      setError('')
      const invoice = await window.desktop.invoices.get(id)
      if (!invoice) throw new Error('Facture introuvable.')
      setSelected(invoice)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ouvrir la facture.')
    }
  }

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Documents finalisés</span>
          <h1>Factures</h1>
          <p>Recherchez, contrôlez et réimprimez les factures sans modifier leur historique.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('invoices')}>
          <FilePlus2 size={19} />
          Nouvelle facture
        </button>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => setError('')}>Fermer</button></div>}

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="N° facture ou nom du client…" />
          </label>
          <span className="result-count">{loading ? 'Chargement…' : `${invoices.length} facture(s)`}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table invoice-history-table">
            <thead>
              <tr><th>N° facture</th><th>Date</th><th>Client</th><th>Lignes</th><th>Total HT</th><th>TVA</th><th>Total TTC</th><th></th></tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><span className="invoice-number-cell"><ReceiptText size={15} />{invoice.number}</span></td>
                  <td>{formatDate(invoice.finalizedAt, localeFor(lang))}</td>
                  <td><strong>{invoice.customerName}</strong></td>
                  <td>{invoice.lineCount}</td>
                  <td>{formatTnd(invoice.subtotalHtMillimes, localeFor(lang))}</td>
                  <td>{formatTnd(invoice.taxMillimes, localeFor(lang))}</td>
                  <td><strong>{formatTnd(invoice.totalTtcMillimes, localeFor(lang))}</strong></td>
                  <td>
                    <button className="row-preview-button" type="button" onClick={() => void openInvoice(invoice.id)}>
                      <Eye size={15} />Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && invoices.length === 0 && <div className="table-empty">Aucune facture finalisée ne correspond à cette recherche.</div>}
        </div>
      </section>

      {selected && <FinalizedInvoicePreview invoice={selected} lang={lang} onClose={() => setSelected(null)} />}
    </div>
  )
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
