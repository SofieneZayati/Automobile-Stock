import {
  useCallback,
  useEffect,
  useState,
  type JSX
} from 'react'
import {
  ArrowRightLeft,
  Ban,
  Eye,
  FilePlus2,
  ReceiptText,
  Search,
  ShieldAlert,
  Undo2,
  X
} from 'lucide-react'
import type {
  FinalizedInvoice,
  InvoiceListItem,
  ReturnInvoiceInput
} from '../../../shared/contracts'
import type { Page } from '../components/Sidebar'
import { FinalizedInvoicePreview } from '../components/FinalizedInvoicePreview'
import { Language, localeFor, t, tr } from '../i18n'
import { formatTnd } from '../lib/money'

export function InvoiceHistory({
  lang,
  onNavigate,
  onStartExchange
}: {
  lang: Language
  onNavigate: (page: Page) => void
  onStartExchange: (invoice: FinalizedInvoice) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selected, setSelected] = useState<FinalizedInvoice | null>(null)
  const [cancelling, setCancelling] = useState<InvoiceListItem | null>(null)
  const [returning, setReturning] = useState<FinalizedInvoice | null>(null)
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
          : tr(lang, 'Impossible de charger les factures.', 'Unable to load invoices.', 'تعذر تحميل الفواتير.')
      )
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(query), 160)
    return () => window.clearTimeout(timeout)
  }, [query, load])

  async function openInvoice(id: number): Promise<void> {
    try {
      setError('')
      const invoice = await window.desktop.invoices.get(id)
      if (!invoice) throw new Error(tr(lang, 'Facture introuvable.', 'Invoice not found.', 'الفاتورة غير موجودة.'))
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
      setNotice(tr(lang, `Facture ${cancelled.number} annulée. Les quantités vendues ont été réintégrées au stock.`, `Invoice ${cancelled.number} cancelled. Sold quantities were restored to stock.`, `تم إلغاء الفاتورة ${cancelled.number} وإرجاع الكميات المباعة إلى المخزون.`))
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

  async function beginReturn(id: number): Promise<void> {
    try {
      setError('')
      const invoice = await window.desktop.invoices.get(id)
      if (!invoice) throw new Error(tr(lang, 'Facture introuvable.', 'Invoice not found.', 'الفاتورة غير موجودة.'))
      setReturning(invoice)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de préparer le retour.'
      )
    }
  }

  async function completeReturn(
    input: ReturnInvoiceInput,
    prepareExchange: boolean
  ): Promise<void> {
    try {
      setError('')
      setNotice('')
      const updated = await window.desktop.invoices.returnItems(input)
      const latestReturn = updated.returns.at(-1)
      setReturning(null)
      setNotice(tr(lang, `${latestReturn?.number ?? 'Retour'} enregistré. Les quantités ont été réintégrées au stock.`, `${latestReturn?.number ?? 'Return'} recorded. The quantities were restored to stock.`, `تم تسجيل ${latestReturn?.number ?? 'الإرجاع'} وإعادة الكميات إلى المخزون.`))
      if (selected?.id === updated.id) setSelected(updated)
      await load(query)
      if (prepareExchange) onStartExchange(updated)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer le retour.'
      )
      throw cause
    }
  }

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{tr(lang, 'Documents finalisés & annulés', 'Finalized & cancelled documents', 'الوثائق المؤكدة والملغاة')}</span>
          <h1>{t(lang, 'invoices')}</h1>
          <p>{tr(lang, 'Recherchez, réimprimez et enregistrez les retours ou échanges.', 'Find, reprint and record returns or exchanges.', 'ابحث وأعد الطباعة وسجّل المرتجعات أو الاستبدالات.')}</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => onNavigate('invoices')}
        >
          <FilePlus2 size={19} />
          {t(lang, 'newInvoice')}
        </button>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      {notice && (
        <div className="inline-alert success">
          {notice}
          <button type="button" onClick={() => setNotice('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr(lang, 'N° facture ou nom du client…', 'Invoice no. or customer name…', 'رقم الفاتورة أو اسم الحريف…')}
            />
          </label>
          <span className="result-count">
            {loading ? tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…') : tr(lang, `${invoices.length} facture(s)`, `${invoices.length} invoice(s)`, `${invoices.length} فاتورة`)}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table invoice-history-table">
            <thead>
              <tr>
                <th>{tr(lang, 'N° facture', 'Invoice no.', 'رقم الفاتورة')}</th>
                <th>{tr(lang, 'Statut', 'Status', 'الحالة')}</th>
                <th>{tr(lang, 'Date', 'Date', 'التاريخ')}</th>
                <th>{t(lang, 'customer')}</th>
                <th>{tr(lang, 'Lignes', 'Lines', 'الأسطر')}</th>
                <th>{tr(lang, 'Total HT', 'Subtotal', 'المجموع دون أداء')}</th>
                <th>{t(lang, 'vat')}</th>
                <th>{tr(lang, 'Net TTC', 'Net total', 'الصافي شامل الأداء')}</th>
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
                        ? tr(lang, 'Annulée', 'Cancelled', 'ملغاة')
                        : invoice.returnStatus === 'FULL'
                          ? tr(lang, 'Retournée', 'Returned', 'مرتجعة')
                          : invoice.returnStatus === 'PARTIAL'
                            ? tr(lang, 'Retour partiel', 'Partially returned', 'إرجاع جزئي')
                            : tr(lang, 'Finalisée', 'Finalized', 'مؤكدة')}
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
                        invoice.netTtcMillimes,
                        localeFor(lang)
                      )}
                    </strong>
                    {invoice.returnedTtcMillimes > 0 && (
                      <span className="returned-amount">
                        - {formatTnd(invoice.returnedTtcMillimes, localeFor(lang))}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="invoice-row-actions">
                      <button
                        className="row-preview-button"
                        type="button"
                        onClick={() => void openInvoice(invoice.id)}
                      >
                        <Eye size={15} />
                        {tr(lang, 'Ouvrir', 'Open', 'فتح')}
                      </button>
                      {invoice.status === 'FINALIZED' && (
                        <button
                          className="row-return-button"
                          type="button"
                          onClick={() => void beginReturn(invoice.id)}
                          disabled={invoice.returnStatus === 'FULL'}
                        >
                          <Undo2 size={15} />
                          {tr(lang, 'Retour / échange', 'Return / exchange', 'إرجاع / استبدال')}
                        </button>
                      )}
                      {invoice.status === 'FINALIZED' && invoice.returnStatus === 'NONE' && (
                        <button
                          className="row-cancel-button"
                          type="button"
                          onClick={() => setCancelling(invoice)}
                        >
                          <Ban size={15} />
                          {tr(lang, 'Annuler', 'Cancel', 'إلغاء')}
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
              {tr(lang, 'Aucune facture ne correspond à cette recherche.', 'No invoice matches this search.', 'لا توجد فاتورة مطابقة لهذا البحث.')}
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
          lang={lang}
          onClose={() => setCancelling(null)}
          onConfirm={(reason) =>
            completeCancellation(cancelling, reason)
          }
        />
      )}

      {returning && (
        <ReturnDialog
          invoice={returning}
          lang={lang}
          locale={localeFor(lang)}
          onClose={() => setReturning(null)}
          onConfirm={completeReturn}
        />
      )}
    </div>
  )
}

function ReturnDialog({
  invoice,
  lang,
  locale,
  onClose,
  onConfirm
}: {
  invoice: FinalizedInvoice
  lang: Language
  locale: string
  onClose: () => void
  onConfirm: (
    input: ReturnInvoiceInput,
    prepareExchange: boolean
  ) => Promise<void>
}): JSX.Element {
  const availableLines = invoice.lines.filter(
    (line) => line.returnableQuantity > 0
  )
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [prepareExchange, setPrepareExchange] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedLines = availableLines
    .map((line) => ({
      invoiceLineId: line.invoiceLineId,
      quantity: quantities[line.invoiceLineId] ?? 0
    }))
    .filter((line) => line.quantity > 0)

  const estimatedGross = availableLines.reduce((sum, line) => {
    const quantity = quantities[line.invoiceLineId] ?? 0
    return sum + Math.round(line.lineTtcMillimes * quantity / line.quantity)
  }, 0)

  async function confirm(): Promise<void> {
    if (selectedLines.length === 0) {
      setError(tr(lang, 'Indiquez la quantité d’au moins une pièce retournée.', 'Enter a quantity for at least one returned part.', 'أدخل كمية لقطعة واحدة مرتجعة على الأقل.'))
      return
    }
    if (!reason.trim()) {
      setError(tr(lang, 'Indiquez la raison du retour.', 'Enter the reason for the return.', 'أدخل سبب الإرجاع.'))
      return
    }

    try {
      setBusy(true)
      setError('')
      await onConfirm({
        invoiceId: invoice.id,
        reason: reason.trim(),
        lines: selectedLines
      }, prepareExchange)
    } catch {
      setError(
        tr(lang, 'Le retour n’a pas été enregistré. Le stock n’a pas été modifié.', 'The return was not recorded. Stock was not changed.', 'لم يتم تسجيل الإرجاع ولم يتغير المخزون.')
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
      <div className="modal-card return-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{tr(lang, 'Retour client', 'Customer return', 'إرجاع حريف')}</span>
            <h2>{tr(lang, 'Retour / échange', 'Return / exchange', 'إرجاع / استبدال')} — {invoice.number}</h2>
            <p>{tr(lang, 'Saisissez uniquement les quantités réellement rapportées par le client.', 'Enter only the quantities actually brought back by the customer.', 'أدخل فقط الكميات التي أرجعها الحريف فعليًا.')}</p>
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

        <div className="return-lines">
          {availableLines.map((line) => (
            <div className="return-line" key={line.invoiceLineId}>
              <div>
                <strong>{line.designation}</strong>
                <span>{line.reference}</span>
                <small>
                  {tr(lang, 'Vendue', 'Sold', 'مباعة')}: {line.quantity} · {tr(lang, 'Déjà retournée', 'Already returned', 'تم إرجاعها')}: {line.returnedQuantity}
                </small>
              </div>
              <label className="field">
                <span>{tr(lang, 'Quantité retournée', 'Returned quantity', 'الكمية المرتجعة')}</span>
                <input
                  type="number"
                  min="0"
                  max={line.returnableQuantity}
                  value={quantities[line.invoiceLineId] ?? 0}
                  onChange={(event) => {
                    const value = Math.max(
                      0,
                      Math.min(
                        line.returnableQuantity,
                        Number.parseInt(event.target.value, 10) || 0
                      )
                    )
                    setQuantities((current) => ({
                      ...current,
                      [line.invoiceLineId]: value
                    }))
                  }}
                />
                <small>{tr(lang, 'Maximum', 'Maximum', 'الحد الأقصى')}: {line.returnableQuantity}</small>
              </label>
            </div>
          ))}
        </div>

        <div className="return-summary">
          <span>{tr(lang, 'Montant indicatif avant remise générale', 'Estimated amount before overall discount', 'المبلغ التقديري قبل الخصم العام')}</span>
          <strong>{formatTnd(estimatedGross, locale)}</strong>
        </div>

        <label className="field return-reason">
          <span>{tr(lang, 'Raison du retour *', 'Reason for return *', 'سبب الإرجاع *')}</span>
          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={tr(lang, 'Ex. pièce incompatible, échange de référence…', 'E.g. incompatible part, change of reference…', 'مثال: قطعة غير متوافقة، تغيير المرجع…')}
          />
        </label>

        <label className="exchange-option">
          <input
            type="checkbox"
            checked={prepareExchange}
            onChange={(event) => setPrepareExchange(event.target.checked)}
          />
          <ArrowRightLeft size={18} />
          <span>
            <strong>{tr(lang, 'Préparer un échange après le retour', 'Prepare an exchange after the return', 'تحضير استبدال بعد الإرجاع')}</strong>
            <small>{tr(lang, 'Une nouvelle facture sera ouverte avec le même client pour choisir la pièce de remplacement.', 'A new invoice will open with the same customer to choose the replacement part.', 'ستفتح فاتورة جديدة لنفس الحريف لاختيار القطعة البديلة.')}</small>
          </span>
        </label>

        {error && <div className="inline-alert error return-error">{error}</div>}

        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {tr(lang, 'Fermer', 'Close', 'إغلاق')}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void confirm()}
            disabled={busy || selectedLines.length === 0 || !reason.trim()}
          >
            {prepareExchange ? <ArrowRightLeft size={17} /> : <Undo2 size={17} />}
            {busy
              ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…')
              : prepareExchange
                ? tr(lang, 'Valider le retour et préparer l’échange', 'Confirm return and prepare exchange', 'تأكيد الإرجاع وتحضير الاستبدال')
                : tr(lang, 'Valider le retour', 'Confirm return', 'تأكيد الإرجاع')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CancellationDialog({
  invoice,
  lang,
  onClose,
  onConfirm
}: {
  invoice: InvoiceListItem
  lang: Language
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}): JSX.Element {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm(): Promise<void> {
    if (!reason.trim()) {
      setError(tr(lang, 'Indiquez la raison de l’annulation.', 'Enter the reason for cancellation.', 'أدخل سبب الإلغاء.'))
      return
    }

    try {
      setBusy(true)
      setError('')
      await onConfirm(reason.trim())
    } catch {
      setError(
        tr(lang, 'L’annulation n’a pas été enregistrée. Le stock n’a pas été modifié.', 'The cancellation was not recorded. Stock was not changed.', 'لم يتم تسجيل الإلغاء ولم يتغير المخزون.')
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
            <span className="eyebrow">{tr(lang, 'Correction de vente', 'Sales correction', 'تصحيح البيع')}</span>
            <h2>{tr(lang, 'Annuler', 'Cancel', 'إلغاء')} {invoice.number}</h2>
            <p>{tr(lang, 'La facture restera dans l’historique avec le statut annulé.', 'The invoice will remain in history with cancelled status.', 'ستبقى الفاتورة في السجل بحالة ملغاة.')}</p>
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
            <strong>{tr(lang, 'Le stock sera automatiquement réintégré.', 'Stock will be restored automatically.', 'سيُعاد المخزون تلقائيًا.')}</strong>
            <span>{tr(lang, 'Utilisez cette action pour corriger une vente saisie par erreur. Pour une pièce rapportée par un client, utilisez plutôt « Retour / échange ».', 'Use this action to correct a sale entered by mistake. For a part brought back by a customer, use “Return / exchange”.', 'استخدم هذا الإجراء لتصحيح بيع أُدخل بالخطأ. وللقطعة التي يعيدها الحريف استخدم «إرجاع / استبدال».')}</span>
          </div>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        <label className="field">
          <span>{tr(lang, 'Raison de l’annulation *', 'Reason for cancellation *', 'سبب الإلغاء *')}</span>
          <textarea
            autoFocus
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={tr(lang, 'Ex. erreur de saisie…', 'E.g. data entry error…', 'مثال: خطأ في الإدخال…')}
          />
        </label>

        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {tr(lang, 'Retour', 'Back', 'رجوع')}
          </button>
          <button
            className="danger-confirm-button"
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !reason.trim()}
          >
            <Ban size={17} />
            {busy
              ? tr(lang, 'Annulation…', 'Cancelling…', 'جار الإلغاء…')
              : tr(lang, 'Annuler la facture et réintégrer le stock', 'Cancel invoice and restore stock', 'إلغاء الفاتورة وإعادة المخزون')}
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
