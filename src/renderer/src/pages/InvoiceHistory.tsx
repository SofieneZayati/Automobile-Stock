import {
  useCallback,
  useEffect,
  useState,
  type JSX
} from 'react'
import {
  Ban,
  Eye,
  FilePlus2,
  ReceiptText,
  Search,
  ShieldAlert,
  X
} from 'lucide-react'
import type {
  FinalizedInvoice,
  InvoiceListItem
} from '../../../shared/contracts'
import type { Page } from '../components/Sidebar'
import { FinalizedInvoicePreview } from '../components/FinalizedInvoicePreview'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'

export function InvoiceHistory({
  lang,
  onNavigate
}: {
  lang: Language
  onNavigate: (page: Page) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selected, setSelected] = useState<FinalizedInvoice | null>(null)
  const [cancelling, setCancelling] = useState<InvoiceListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (search: string) => {
    try {
      setLoading(true)
      setError('')
      setInvoices(await window.desktop.invoices.list(search))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger les factures.'
      )
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
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’ouvrir la facture.'
      )
    }
  }

  async function completeCancellation(
    invoice: InvoiceListItem,
    reason: string
  ): Promise<void> {
    try {
      setError('')
      setNotice('')
      const cancelled = await window.desktop.invoices.cancel(
        invoice.id,
        reason
      )
      setCancelling(null)
      setNotice(
        `Facture ${cancelled.number} annulée. Les quantités vendues ont été réintégrées au stock.`
      )
      if (selected?.id === cancelled.id) {
        setSelected(cancelled)
      }
      await load(query)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’annuler la facture.'
      )
      throw cause
    }
  }

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Documents finalisés & annulés</span>
          <h1>Factures</h1>
          <p>
            Recherchez et réimprimez les documents. Une annulation conserve
            la facture originale et crée les mouvements de stock inverses.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => onNavigate('invoices')}
        >
          <FilePlus2 size={19} />
          Nouvelle facture
        </button>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>Fermer</button>
        </div>
      )}

      {notice && (
        <div className="inline-alert success">
          {notice}
          <button type="button" onClick={() => setNotice('')}>Fermer</button>
        </div>
      )}

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="N° facture ou nom du client…"
            />
          </label>
          <span className="result-count">
            {loading ? 'Chargement…' : `${invoices.length} facture(s)`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table invoice-history-table">
            <thead>
              <tr>
                <th>N° facture</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Client</th>
                <th>Lignes</th>
                <th>Total HT</th>
                <th>TVA</th>
                <th>Total TTC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={
                    invoice.status === 'CANCELLED'
                      ? 'cancelled-invoice-row'
                      : ''
                  }
                >
                  <td>
                    <span className="invoice-number-cell">
                      <ReceiptText size={15} />
                      {invoice.number}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        invoice.status === 'CANCELLED'
                          ? 'invoice-status cancelled'
                          : 'invoice-status finalized'
                      }
                    >
                      {invoice.status === 'CANCELLED'
                        ? 'Annulée'
                        : 'Finalisée'}
                    </span>
                  </td>
                  <td>
                    {formatDate(
                      invoice.status === 'CANCELLED' && invoice.cancelledAt
                        ? invoice.cancelledAt
                        : invoice.finalizedAt,
                      localeFor(lang)
                    )}
                  </td>
                  <td><strong>{invoice.customerName}</strong></td>
                  <td>{invoice.lineCount}</td>
                  <td>
                    {formatTnd(
                      invoice.subtotalHtMillimes,
                      localeFor(lang)
                    )}
                  </td>
                  <td>
                    {formatTnd(invoice.taxMillimes, localeFor(lang))}
                  </td>
                  <td>
                    <strong>
                      {formatTnd(
                        invoice.totalTtcMillimes,
                        localeFor(lang)
                      )}
                    </strong>
                  </td>
                  <td>
                    <div className="invoice-row-actions">
                      <button
                        className="row-preview-button"
                        type="button"
                        onClick={() => void openInvoice(invoice.id)}
                      >
                        <Eye size={15} />
                        Ouvrir
                      </button>
                      {invoice.status === 'FINALIZED' && (
                        <button
                          className="row-cancel-button"
                          type="button"
                          onClick={() => setCancelling(invoice)}
                        >
                          <Ban size={15} />
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && invoices.length === 0 && (
            <div className="table-empty">
              Aucune facture ne correspond à cette recherche.
            </div>
          )}
        </div>
      </section>

      {selected && (
        <FinalizedInvoicePreview
          invoice={selected}
          lang={lang}
          onClose={() => setSelected(null)}
        />
      )}

      {cancelling && (
        <CancellationDialog
          invoice={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={(reason) =>
            completeCancellation(cancelling, reason)
          }
        />
      )}
    </div>
  )
}

function CancellationDialog({
  invoice,
  onClose,
  onConfirm
}: {
  invoice: InvoiceListItem
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}): JSX.Element {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm(): Promise<void> {
    if (!reason.trim()) {
      setError('Indiquez la raison de l’annulation.')
      return
    }

    try {
      setBusy(true)
      setError('')
      await onConfirm(reason.trim())
    } catch {
      setError(
        'L’annulation n’a pas été enregistrée. Aucune quantité ne doit être considérée comme restaurée.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="modal-card cancellation-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Opération irréversible</span>
            <h2>Annuler {invoice.number}</h2>
            <p>
              La facture restera dans l’historique avec le statut annulé.
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <div className="cancellation-warning">
          <ShieldAlert size={20} />
          <div>
            <strong>Le stock sera automatiquement réintégré.</strong>
            <span>
              L’application ajoutera des mouvements “Annulation” pour
              chaque pièce vendue. La facture originale ne sera ni supprimée
              ni réécrite. Cette action est une annulation interne et ne crée
              pas un avoir fiscal; le workflow d’avoir devra être activé
              seulement après confirmation des règles du client.
            </span>
          </div>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        <label className="field">
          <span>Raison de l’annulation *</span>
          <textarea
            autoFocus
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. erreur de saisie, vente annulée par le client…"
          />
        </label>

        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Retour
          </button>
          <button
            className="danger-confirm-button"
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !reason.trim()}
          >
            <Ban size={17} />
            {busy
              ? 'Annulation…'
              : 'Annuler la facture et réintégrer le stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}
