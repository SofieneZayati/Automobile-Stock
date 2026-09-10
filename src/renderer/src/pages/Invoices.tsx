import { useEffect, useMemo, useState, type JSX } from 'react'
import {
  CheckCircle2,
  FileDown,
  FilePenLine,
  FileText,
  Percent,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X
} from 'lucide-react'
import type {
  BusinessSettings,
  Client,
  FinalizedInvoice,
  FinalizeInvoiceInput,
  InvoiceDraftListItem,
  Part
} from '../../../shared/contracts'
import { Language, localeFor, t, tr } from '../i18n'
import { formatTnd, percentageAmount } from '../lib/money'
import { BrandLogo } from '../components/BrandLogo'

type DraftLine = {
  id: string
  partId: number
  ref: string
  designation: string
  stockAvailable: number
  qty: number
  listUnitPriceMillimes: number
  clientUnitPriceText: string
  taxPercent?: number
}

type AdjustmentMode = 'discount' | 'target'

type DraftCalculation = {
  valid: boolean
  priceError: string | null
  subtotalGrossHt: number
  lineDiscount: number
  netHt: number
  vat: number
  totalBeforeGlobal: number
  globalDiscount: number
  total: number
  adjustmentValue: number | null
  adjustmentError: string | null
}

export type InvoiceCustomerPrefill = {
  key: string
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  customerTaxId: string | null
  sourceInvoiceNumber: string
}

export function Invoices({
  lang,
  onDirtyChange,
  customerPrefill
}: {
  lang: Language
  onDirtyChange?: (dirty: boolean) => void
  customerPrefill?: InvoiceCustomerPrefill | null
}): JSX.Element {
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customer, setCustomer] = useState(t(lang, 'walkIn'))
  const [showPicker, setShowPicker] = useState(false)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerTaxId, setCustomerTaxId] = useState('')
  const [notes, setNotes] = useState('')
  const [draftId, setDraftId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<InvoiceDraftListItem[]>([])
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savedFingerprint, setSavedFingerprint] = useState('')
  const [draftNotice, setDraftNotice] = useState('')
  const [finalized, setFinalized] = useState<FinalizedInvoice | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>('target')
  const [adjustmentText, setAdjustmentText] = useState('')
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const locale = localeFor(lang)
  const taxPercent = finalized?.business.defaultTaxPercent
    ?? business?.defaultTaxPercent
    ?? 19

  useEffect(() => {
    if (!customerPrefill) return
    setLines([])
    setCustomer(customerPrefill.customerName)
    setCustomerPhone(customerPrefill.customerPhone ?? '')
    setCustomerAddress(customerPrefill.customerAddress ?? '')
    setCustomerTaxId(customerPrefill.customerTaxId ?? '')
    setSelectedClient(null)
    setNotes(tr(lang, `Échange suite au retour de la facture ${customerPrefill.sourceInvoiceNumber}`, `Exchange following return from invoice ${customerPrefill.sourceInvoiceNumber}`, `استبدال بعد إرجاع من الفاتورة ${customerPrefill.sourceInvoiceNumber}`))
    setDraftId(null)
    setSavedFingerprint('')
    setDraftNotice(tr(lang, 'Retour enregistré. Ajoutez maintenant la pièce de remplacement.', 'Return recorded. Now add the replacement part.', 'تم تسجيل الإرجاع. أضف الآن القطعة البديلة.'))
    setFinalized(null)
    setAdjustmentMode('target')
    setAdjustmentText('')
    setError('')
  }, [customerPrefill])

  useEffect(() => {
    let active = true
    void window.desktop.settings.getBusiness()
      .then((settings) => {
        if (!active) return
        setBusiness(settings)
        setCustomer((current) =>
          lines.length === 0 && current === t(lang, 'walkIn')
            ? settings.defaultCustomerName
            : current
        )
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Impossible de charger les paramètres.')
        }
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    void window.desktop.invoices.listDrafts()
      .then((result) => {
        if (active) setDrafts(result)
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Impossible de charger les brouillons.'
          )
        }
      })

    return () => {
      active = false
    }
  }, [])

  const calculation = useMemo(
    () => calculateDraft(lines, adjustmentMode, adjustmentText, taxPercent),
    [lines, adjustmentMode, adjustmentText, taxPercent]
  )

  const contentFingerprint = useMemo(
    () => invoiceContentFingerprint({
      customer,
      customerPhone,
      customerAddress,
      customerTaxId,
      notes,
      adjustmentMode,
      adjustmentText,
      lines
    }),
    [
      customer,
      customerPhone,
      customerAddress,
      customerTaxId,
      notes,
      adjustmentMode,
      adjustmentText,
      lines
    ]
  )

  const dirty =
    !finalized
    && lines.length > 0
    && contentFingerprint !== savedFingerprint

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    return () => onDirtyChange?.(false)
  }, [onDirtyChange])

  useEffect(() => {
    function handleInvoiceShortcut(event: KeyboardEvent): void {
      if (
        event.key === 'F2'
        && !finalized
        && !showClientPicker
      ) {
        event.preventDefault()
        setShowPicker(true)
      }
    }

    window.addEventListener('keydown', handleInvoiceShortcut)
    return () =>
      window.removeEventListener('keydown', handleInvoiceShortcut)
  }, [finalized, showClientPicker])

  function updateQty(id: string, qty: number): void {
    setLines((current) => current.map((line) => line.id === id
      ? { ...line, qty: Math.max(1, Math.min(line.stockAvailable, qty || 1)) }
      : line
    ))
  }

  function updateClientPrice(id: string, value: string): void {
    if (!isEditableMoney(value)) return
    setLines((current) => current.map((line) =>
      line.id === id ? { ...line, clientUnitPriceText: value } : line
    ))
  }

  function removeLine(id: string): void {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  function addPart(part: Part): void {
    setLines((current) => {
      const existing = current.find((line) => line.partId === part.id)
      if (existing) {
        return current.map((line) => line.partId === part.id
          ? { ...line, qty: Math.min(line.stockAvailable, line.qty + 1) }
          : line
        )
      }

      return [...current, {
        id: `part-${part.id}`,
        partId: part.id,
        ref: part.reference,
        designation: [part.designation, part.vehicleCompatibility].filter(Boolean).join(' — '),
        stockAvailable: part.quantity,
        qty: 1,
        listUnitPriceMillimes: part.salePriceMillimes,
        clientUnitPriceText: editableTnd(part.salePriceMillimes)
      }]
    })
    setShowPicker(false)
  }

  function buildInvoiceInput(includeDraftId: boolean): FinalizeInvoiceInput {
    const adjustmentValue = calculation.adjustmentValue

    return {
      ...(includeDraftId && draftId !== null ? { draftId } : {}),
      clientId: selectedClient?.id,
      customerName: customer,
      customerPhone: (selectedClient?.phone ?? customerPhone) || undefined,
      customerAddress: (selectedClient?.address ?? customerAddress) || undefined,
      customerTaxId: (selectedClient?.taxId ?? customerTaxId) || undefined,
      notes: notes.trim() || undefined,
      ...(adjustmentValue !== null && adjustmentMode === 'target'
        ? { targetTotalTtcMillimes: adjustmentValue }
        : {}),
      ...(adjustmentValue !== null && adjustmentMode === 'discount'
        ? { globalDiscountTtcMillimes: adjustmentValue }
        : {}),
      lines: lines.map((line) => ({
        partId: line.partId,
        reference: line.ref,
        designation: line.designation,
        quantity: line.qty,
        unitPriceHtMillimes: line.listUnitPriceMillimes,
        negotiatedUnitPriceHtMillimes:
          parseTnd(line.clientUnitPriceText) ?? line.listUnitPriceMillimes
      }))
    }
  }

  async function refreshDrafts(): Promise<void> {
    setDrafts(await window.desktop.invoices.listDrafts())
  }

  async function saveDraft(): Promise<void> {
    if (lines.length === 0) {
      setError('Ajoutez au moins une pièce avant d’enregistrer le brouillon.')
      return
    }
    if (!calculation.valid) {
      setError(
        calculation.priceError
        ?? calculation.adjustmentError
        ?? 'Vérifiez les remises avant d’enregistrer.'
      )
      return
    }

    try {
      setSavingDraft(true)
      setError('')
      setDraftNotice('')
      const saved = await window.desktop.invoices.saveDraft(
        buildInvoiceInput(false),
        draftId ?? undefined
      )
      setDraftId(saved.id)
      setSavedFingerprint(contentFingerprint)
      setDraftNotice('Brouillon enregistré dans la base locale.')
      await refreshDrafts()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer le brouillon.'
      )
    } finally {
      setSavingDraft(false)
    }
  }

  async function openDraft(id: number): Promise<void> {
    try {
      setError('')
      setDraftNotice('')
      const draft = await window.desktop.invoices.getDraft(id)
      if (!draft) throw new Error('Brouillon introuvable.')

      setFinalized(null)
      setDraftId(draft.id)
      setCustomer(draft.customerName)
      setCustomerPhone(draft.customerPhone ?? '')
      setCustomerAddress(draft.customerAddress ?? '')
      setCustomerTaxId(draft.customerTaxId ?? '')
      setNotes(draft.notes ?? '')
      const draftAdjustmentText =
        draft.globalDiscountTtcMillimes > 0
          ? editableTnd(draft.globalDiscountTtcMillimes)
          : ''

      setAdjustmentMode('discount')
      setAdjustmentText(draftAdjustmentText)

      const restoredLines: DraftLine[] = draft.lines.map(
        (line, index) => ({
          id: `draft-${draft.id}-${line.partId ?? index}-${index}`,
          partId: line.partId ?? 0,
          ref: line.reference,
          designation: line.designation,
          stockAvailable: line.currentStock ?? line.quantity,
          qty: line.quantity,
          listUnitPriceMillimes: line.unitPriceHtMillimes,
          clientUnitPriceText: editableTnd(
            line.negotiatedUnitPriceHtMillimes
          )
        })
      )
      setLines(restoredLines)
      setSavedFingerprint(
        invoiceContentFingerprint({
          customer: draft.customerName,
          customerPhone: draft.customerPhone ?? '',
          customerAddress: draft.customerAddress ?? '',
          customerTaxId: draft.customerTaxId ?? '',
          notes: draft.notes ?? '',
          adjustmentMode: 'discount',
          adjustmentText: draftAdjustmentText,
          lines: restoredLines
        })
      )

      if (draft.clientId) {
        const candidates = await window.desktop.clients.list(draft.customerName)
        const client = candidates.find((candidate) => candidate.id === draft.clientId) ?? null
        setSelectedClient(client)
      } else {
        setSelectedClient(null)
      }

      const unavailable = draft.lines.some(
        (line) =>
          line.partId === null
          || !line.currentPartActive
          || line.currentStock === null
          || line.currentStock < line.quantity
      )
      if (unavailable) {
        setDraftNotice(
          'Brouillon chargé. Certaines pièces ont changé ou le stock est insuffisant; vérifiez-les avant validation.'
        )
      } else {
        setDraftNotice('Brouillon chargé.')
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’ouvrir le brouillon.'
      )
    }
  }

  async function deleteDraft(id: number): Promise<void> {
    const confirmed = window.confirm('Supprimer ce brouillon ?')
    if (!confirmed) return

    try {
      setError('')
      const deleted = await window.desktop.invoices.deleteDraft(id)
      if (!deleted) throw new Error('Brouillon introuvable.')
      if (draftId === id) {
        setDraftId(null)
        setSavedFingerprint('')
        setDraftNotice(
          'Brouillon supprimé. Les données restent dans l’éditeur mais ne sont plus sauvegardées.'
        )
      }
      await refreshDrafts()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de supprimer le brouillon.'
      )
    }
  }

  async function savePdf(): Promise<void> {
    try {
      setSavingPdf(true)
      setError('')
      await window.desktop.documents.saveCurrentInvoicePdf(
        finalized
          ? `Facture-${finalized.number}`
          : 'Apercu-Facture'
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer le PDF.'
      )
    } finally {
      setSavingPdf(false)
    }
  }

  async function finalize(): Promise<void> {
    if (lines.length === 0) {
      setError('Ajoutez au moins une pièce avant de valider la facture.')
      return
    }

    if (!calculation.valid) {
      setError(
        calculation.priceError
        ?? calculation.adjustmentError
        ?? 'Vérifiez les remises avant de finaliser.'
      )
      return
    }

    try {
      setFinalizing(true)
      setError('')

      const result = await window.desktop.invoices.finalize(
        buildInvoiceInput(true)
      )

      setFinalized(result)
      setSavedFingerprint(contentFingerprint)
      setDraftId(null)
      setDraftNotice('')
      await refreshDrafts()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de finaliser la facture.')
    } finally {
      setFinalizing(false)
    }
  }

  function newInvoice(): void {
    setLines([])
    setSelectedClient(null)
    setCustomer(business?.defaultCustomerName ?? t(lang, 'walkIn'))
    setCustomerPhone('')
    setCustomerAddress('')
    setCustomerTaxId('')
    setNotes('')
    setDraftId(null)
    setSavedFingerprint('')
    setDraftNotice('')
    setFinalized(null)
    setAdjustmentMode('target')
    setAdjustmentText('')
    setError('')
  }

  const paper = finalized
    ? {
        number: finalized.number,
        finalizedAt: finalized.finalizedAt,
        customerName: finalized.customerName,
        customerPhone: finalized.customerPhone,
        customerAddress: finalized.customerAddress,
        customerTaxId: finalized.customerTaxId,
        notes: finalized.notes,
        subtotalGrossHt: finalized.subtotalHtMillimes,
        lineDiscount: finalized.discountMillimes,
        netHt: finalized.subtotalHtMillimes - finalized.discountMillimes,
        vat: finalized.taxMillimes,
        totalBeforeGlobal: finalized.totalBeforeGlobalDiscountTtcMillimes,
        globalDiscount: finalized.globalDiscountTtcMillimes,
        total: finalized.totalTtcMillimes,
        taxPercent: finalized.business.defaultTaxPercent,
        business: finalized.business,
        lines: finalized.lines.map((line, index) => ({
          id: `final-${index}`,
          ref: line.reference,
          designation: line.designation,
          qty: line.quantity,
          listUnitPriceMillimes: line.unitPriceHtMillimes,
          clientUnitPriceMillimes: line.netUnitPriceHtMillimes,
          discountMillimes: line.discountMillimes,
          lineHtMillimes: line.lineHtMillimes
        }))
      }
    : {
        number: 'PROVISOIRE',
        finalizedAt: null,
        customerName: customer,
        customerPhone: (selectedClient?.phone ?? customerPhone) || null,
        customerAddress: (selectedClient?.address ?? customerAddress) || null,
        customerTaxId: (selectedClient?.taxId ?? customerTaxId) || null,
        notes: notes.trim() || null,
        subtotalGrossHt: calculation.subtotalGrossHt,
        lineDiscount: calculation.lineDiscount,
        netHt: calculation.netHt,
        vat: calculation.vat,
        totalBeforeGlobal: calculation.totalBeforeGlobal,
        globalDiscount: calculation.globalDiscount,
        total: calculation.total,
        taxPercent,
        business: business ?? fallbackBusinessSettings(),
        lines: lines.map((line) => {
          const clientUnit = parseTnd(line.clientUnitPriceText) ?? line.listUnitPriceMillimes
          return {
            id: line.id,
            ref: line.ref,
            designation: line.designation,
            qty: line.qty,
            listUnitPriceMillimes: line.listUnitPriceMillimes,
            clientUnitPriceMillimes: clientUnit,
            discountMillimes: Math.max(0, line.listUnitPriceMillimes - clientUnit) * line.qty,
            lineHtMillimes: clientUnit * line.qty
          }
        })
      }

  return (
    <div className="page invoice-page">
      <section className="page-heading invoice-heading">
        <div>
          <span className="eyebrow">{tr(lang, 'Facturation · Prix négociables avant validation', 'Invoicing · Prices can be adjusted before finalizing', 'الفوترة · يمكن تعديل الأسعار قبل التأكيد')}</span>
          <h1>{finalized ? tr(lang, `Facture ${finalized.number}`, `Invoice ${finalized.number}`, `فاتورة ${finalized.number}`) : t(lang, 'invoiceDraft')}</h1>
          <p>
            {finalized
              ? tr(lang, 'La facture est finalisée et les prix/remises sont maintenant figés.', 'The invoice is finalized and prices/discounts are now locked.', 'تم تأكيد الفاتورة وتثبيت الأسعار والخصومات.')
              : tr(lang, 'Modifiez le prix d’une pièce ou arrondissez directement le total avant de valider.', 'Adjust a part price or round the total before finalizing.', 'عدّل سعر قطعة أو قرّب المجموع قبل التأكيد.')}
          </p>
        </div>
        <div className="heading-actions">
          {finalized ? (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void savePdf()}
                disabled={savingPdf}
              >
                <FileDown size={18} />
                {savingPdf ? 'PDF…' : tr(lang, 'Enregistrer PDF', 'Save PDF', 'حفظ PDF')}
              </button>
              <button className="secondary-button" type="button" onClick={() => window.print()}>
                <Printer size={18} />{tr(lang, 'Imprimer', 'Print', 'طباعة')}
              </button>
              <button className="primary-button" type="button" onClick={newInvoice}>
                <RotateCcw size={18} />{t(lang, 'newInvoice')}
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void saveDraft()}
                disabled={savingDraft || finalizing || lines.length === 0 || !calculation.valid}
              >
                <Save size={18} />
                {savingDraft ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : draftId ? tr(lang, 'Mettre à jour', 'Update', 'تحديث') : t(lang, 'saveDraft')}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void savePdf()}
                disabled={savingPdf || lines.length === 0}
              >
                <FileDown size={18} />
                {savingPdf ? 'PDF…' : 'PDF'}
              </button>
              <button className="secondary-button" type="button" onClick={() => window.print()}>
                <Printer size={18} />{t(lang, 'print')}
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void finalize()}
                disabled={finalizing || lines.length === 0 || !calculation.valid}
              >
                <CheckCircle2 size={18} />
                {finalizing ? tr(lang, 'Validation…', 'Finalizing…', 'جار التأكيد…') : t(lang, 'finalize')}
              </button>
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      {draftNotice && !finalized && (
        <div className="inline-alert success">
          <FilePenLine size={18} />
          {draftNotice}
          <button type="button" onClick={() => setDraftNotice('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      {finalized && (
        <div className="inline-alert success">
          <CheckCircle2 size={18} />
          {tr(lang, `Facture ${finalized.number} enregistrée avec ses remises. Les mouvements de stock sont figés.`, `Invoice ${finalized.number} saved with its discounts. Stock movements are locked.`, `تم حفظ الفاتورة ${finalized.number} مع خصوماتها وتثبيت حركات المخزون.`)}
        </div>
      )}

      {!finalized && drafts.length > 0 && (
        <section className="panel saved-drafts-panel">
          <div className="saved-drafts-heading">
            <div>
              <span className="eyebrow">{tr(lang, 'Travail en cours', 'Work in progress', 'عمل جارٍ')}</span>
              <strong>{tr(lang, 'Brouillons sauvegardés', 'Saved drafts', 'المسودات المحفوظة')}</strong>
            </div>
            <span>{drafts.length}</span>
          </div>
          <div className="saved-drafts-list">
            {drafts.map((draft) => (
              <div
                className={draft.id === draftId ? 'saved-draft active' : 'saved-draft'}
                key={draft.id}
              >
                <button
                  className="saved-draft-open"
                  type="button"
                  onClick={() => void openDraft(draft.id)}
                >
                  <FilePenLine size={16} />
                  <span>
                    <strong>{draft.customerName}</strong>
                    <small>
                      {tr(lang, `${draft.lineCount} ligne(s)`, `${draft.lineCount} line(s)`, `${draft.lineCount} سطر`)} · {formatDraftDate(draft.updatedAt, locale)}
                    </small>
                  </span>
                  <b>{formatTnd(draft.totalTtcMillimes, locale)}</b>
                </button>
                <button
                  className="icon-button danger-button"
                  type="button"
                  title={tr(lang, 'Supprimer le brouillon', 'Delete draft', 'حذف المسودة')}
                  onClick={() => void deleteDraft(draft.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="invoice-workspace">
        <section className={finalized ? 'invoice-editor panel locked' : 'invoice-editor panel'}>
          <div className="editor-section">
            <div className="section-label">
              <span>01</span>
              <div>
                <strong>{t(lang, 'customer')}</strong>
                <small>{tr(lang, 'Facultatif pour une vente au comptoir', 'Optional for a walk-in sale', 'اختياري للبيع المباشر')}</small>
              </div>
            </div>
            <div className="invoice-customer-row">
              <label className="field">
                <span>{tr(lang, 'Nom / société', 'Name / company', 'الاسم / الشركة')}</span>
                <input
                  value={finalized?.customerName ?? customer}
                  onChange={(event) => {
                    setCustomer(event.target.value)
                    setSelectedClient(null)
                    setCustomerPhone('')
                    setCustomerAddress('')
                    setCustomerTaxId('')
                  }}
                  disabled={Boolean(finalized)}
                />
              </label>
              {!finalized && (
                <button
                  className="secondary-button customer-picker-button"
                  type="button"
                  onClick={() => setShowClientPicker(true)}
                >
                  <Search size={16} />
                  {tr(lang, 'Choisir un client enregistré', 'Choose a saved customer', 'اختيار حريف مسجل')}
                </button>
              )}
            </div>

            {!finalized && selectedClient && (
              <div className="selected-client-card">
                <div>
                  <strong>{selectedClient.name}</strong>
                  <span>
                    {[selectedClient.phone, selectedClient.address].filter(Boolean).join(' · ') || tr(lang, 'Coordonnées non renseignées', 'No contact details', 'بيانات الاتصال غير مسجلة')}
                  </span>
                  {selectedClient.taxId && <small>MF: {selectedClient.taxId}</small>}
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => {
                    setSelectedClient(null)
                    setCustomer(business?.defaultCustomerName ?? t(lang, 'walkIn'))
                    setCustomerPhone('')
                    setCustomerAddress('')
                    setCustomerTaxId('')
                  }}
                  aria-label="Retirer le client"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {!finalized && !selectedClient && (
              <div className="invoice-customer-details">
                <label className="field">
                  <span>{tr(lang, 'Téléphone client', 'Customer phone', 'هاتف الحريف')}</span>
                  <input
                    inputMode="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    maxLength={40}
                    placeholder="Ex. 22 000 000"
                  />
                </label>
                <label className="field">
                  <span>{tr(lang, 'Adresse client', 'Customer address', 'عنوان الحريف')}</span>
                  <input
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    maxLength={220}
                    placeholder={tr(lang, 'Facultatif', 'Optional', 'اختياري')}
                  />
                </label>
                <label className="field">
                  <span>{tr(lang, 'Matricule fiscal client', 'Customer tax ID', 'المعرّف الجبائي للحريف')}</span>
                  <input
                    value={customerTaxId}
                    onChange={(event) => setCustomerTaxId(event.target.value)}
                    maxLength={80}
                    placeholder={tr(lang, 'Facultatif', 'Optional', 'اختياري')}
                  />
                </label>
              </div>
            )}

            {!finalized && (
              <label className="field invoice-note-field">
                <span>{tr(lang, 'Note facture', 'Invoice note', 'ملاحظة الفاتورة')}</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={tr(lang, 'Ex. règlement, observation ou message au client…', 'E.g. payment, note or message to the customer…', 'مثال: خلاص أو ملاحظة أو رسالة للحريف…')}
                />
              </label>
            )}
          </div>

          <div className="editor-section">
            <div className="section-label">
              <span>02</span>
              <div>
                <strong>{tr(lang, 'Articles & prix client', 'Parts & customer prices', 'القطع وأسعار الحريف')}</strong>
                <small>{tr(lang, 'Le prix catalogue reste visible; vous pouvez saisir le prix réellement accordé.', 'The catalogue price stays visible; enter the price actually given.', 'يبقى سعر الدليل ظاهرًا؛ أدخل السعر الممنوح فعليًا.')}</small>
              </div>
            </div>

            {!finalized && (
              <button className="part-search-button" type="button" onClick={() => setShowPicker(true)}>
                <Search size={18} />
                <span>{tr(lang, 'Rechercher par référence, OEM, désignation ou véhicule…', 'Search by reference, OEM, description or vehicle…', 'ابحث بالمرجع أو OEM أو البيان أو السيارة…')}</span>
                <kbd>F2</kbd>
              </button>
            )}

            <div className="editor-lines negotiated-lines">
              {lines.length === 0 && !finalized && (
                <div className="editor-empty">
                  {tr(lang, 'Aucune ligne. Recherchez une pièce pour commencer la facture.', 'No lines yet. Search for a part to start the invoice.', 'لا توجد أسطر. ابحث عن قطعة لبدء الفاتورة.')}
                </div>
              )}

              {(finalized
                ? paper.lines.map((line) => ({
                    ...line,
                    stockAvailable: 0,
                    clientUnitPriceText: editableTnd(line.clientUnitPriceMillimes)
                  }))
                : lines
              ).map((line) => {
                const listPrice = 'listUnitPriceMillimes' in line
                  ? line.listUnitPriceMillimes
                  : 0
                const clientPrice = 'clientUnitPriceText' in line
                  ? parseTnd(line.clientUnitPriceText)
                  : null
                const hasDiscount =
                  clientPrice !== null && clientPrice < listPrice

                return (
                  <div className="editor-line negotiated-line" key={line.id}>
                    <div className="line-main">
                      <strong>{line.designation}</strong>
                      <small>
                        {line.ref}
                        {!finalized && 'stockAvailable' in line ? ` · stock ${line.stockAvailable}` : ''}
                      </small>
                    </div>

                    <label className="qty-control">
                      <span>{t(lang, 'qty')}</span>
                      <input
                        type="number"
                        min="1"
                        max={!finalized && 'stockAvailable' in line ? line.stockAvailable : line.qty}
                        value={line.qty}
                        disabled={Boolean(finalized)}
                        onChange={(event) => updateQty(line.id, Number(event.target.value))}
                      />
                    </label>

                    <div className="catalogue-price">
                      <span>{tr(lang, 'Catalogue HT', 'List price excl. VAT', 'سعر الدليل دون أداء')}</span>
                      <strong>{formatTnd(listPrice, locale)}</strong>
                    </div>

                    <label className={hasDiscount ? 'negotiated-price discounted' : 'negotiated-price'}>
                      <span>{tr(lang, 'Prix client HT', 'Customer price excl. VAT', 'سعر الحريف دون أداء')}</span>
                      <div>
                        <input
                          inputMode="decimal"
                          value={'clientUnitPriceText' in line ? line.clientUnitPriceText : ''}
                          disabled={Boolean(finalized)}
                          onChange={(event) => updateClientPrice(line.id, event.target.value)}
                        />
                        <small>DT</small>
                      </div>
                    </label>

                    <div className="line-price negotiated-total">
                      <span>{tr(lang, 'Total HT', 'Total excl. VAT', 'المجموع دون أداء')}</span>
                      <strong>
                        {formatTnd(
                          (clientPrice ?? listPrice) * line.qty,
                          locale
                        )}
                      </strong>
                      {hasDiscount && (
                        <small>
                          -{formatTnd((listPrice - (clientPrice ?? listPrice)) * line.qty, locale)}
                        </small>
                      )}
                    </div>

                    {!finalized
                      ? (
                        <button
                          className="icon-button danger-button"
                          type="button"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      )
                      : <span />}
                  </div>
                )
              })}
            </div>

            {!finalized && (
              <button className="add-line-button" type="button" onClick={() => setShowPicker(true)}>
                <Plus size={17} />{tr(lang, 'Ajouter une ligne', 'Add a line', 'إضافة سطر')}
              </button>
            )}

            {!finalized && calculation.priceError && (
              <div className="price-validation">{calculation.priceError}</div>
            )}
          </div>

          <div className="editor-section commercial-adjustment">
            <div className="section-label">
              <span>03</span>
              <div>
                <strong>{tr(lang, 'Remise sur le total', 'Discount on total', 'خصم على المجموع')}</strong>
                <small>{tr(lang, 'Exemple: si le total est 205 DT, choisissez « Total final » et saisissez 200.', 'Example: if the total is 205 TND, choose “Final total” and enter 200.', 'مثال: إذا كان المجموع 205 د.ت، اختر «المجموع النهائي» وأدخل 200.')}</small>
              </div>
            </div>

            {!finalized ? (
              <div className="adjustment-control">
                <div className="adjustment-mode">
                  <button
                    type="button"
                    className={adjustmentMode === 'target' ? 'active' : ''}
                    onClick={() => { setAdjustmentMode('target'); setAdjustmentText('') }}
                  >
                    {tr(lang, 'Total final', 'Final total', 'المجموع النهائي')}
                  </button>
                  <button
                    type="button"
                    className={adjustmentMode === 'discount' ? 'active' : ''}
                    onClick={() => { setAdjustmentMode('discount'); setAdjustmentText('') }}
                  >
                    {tr(lang, 'Remise DT', 'Discount TND', 'خصم د.ت')}
                  </button>
                </div>

                <label className="adjustment-input">
                  <span>
                    {adjustmentMode === 'target'
                      ? tr(lang, 'Total TTC souhaité', 'Desired total incl. VAT', 'المجموع المطلوب شامل الأداء')
                      : tr(lang, 'Remise globale TTC', 'Overall discount incl. VAT', 'الخصم العام شامل الأداء')}
                  </span>
                  <div>
                    <input
                      inputMode="decimal"
                      value={adjustmentText}
                      placeholder={
                        adjustmentMode === 'target'
                          ? editableTnd(calculation.totalBeforeGlobal)
                          : '0.000'
                      }
                      onChange={(event) => {
                        if (isEditableMoney(event.target.value)) {
                          setAdjustmentText(event.target.value)
                        }
                      }}
                    />
                    <small>DT</small>
                  </div>
                </label>

                <div className="adjustment-result">
                  <Percent size={17} />
                  <div>
                    <span>{tr(lang, 'Remise globale calculée', 'Calculated overall discount', 'الخصم العام المحسوب')}</span>
                    <strong>{formatTnd(calculation.globalDiscount, locale)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="locked-discount-summary">
                <span>{tr(lang, 'Remise globale enregistrée', 'Saved overall discount', 'الخصم العام المحفوظ')}</span>
                <strong>{formatTnd(finalized.globalDiscountTtcMillimes, locale)}</strong>
              </div>
            )}

            {!finalized && calculation.adjustmentError && (
              <div className="price-validation">{calculation.adjustmentError}</div>
            )}
          </div>

          <div className="editor-summary invoice-discount-summary">
            <div>
              <span>{tr(lang, 'Total HT catalogue', 'List total excl. VAT', 'مجموع الدليل دون أداء')}</span>
              <strong>{formatTnd(paper.subtotalGrossHt, locale)}</strong>
            </div>

            {paper.lineDiscount > 0 && (
              <div className="discount-row">
                <span>{tr(lang, 'Remises articles', 'Part discounts', 'خصومات القطع')}</span>
                <strong>- {formatTnd(paper.lineDiscount, locale)}</strong>
              </div>
            )}

            <div>
              <span>{tr(lang, 'Total HT net', 'Net total excl. VAT', 'الصافي دون أداء')}</span>
              <strong>{formatTnd(paper.netHt, locale)}</strong>
            </div>
            <div>
              <span>TVA {paper.taxPercent}%</span>
              <strong>{formatTnd(paper.vat, locale)}</strong>
            </div>

            {paper.globalDiscount > 0 && (
              <>
                <div>
                  <span>Sous-total TTC</span>
                  <strong>{formatTnd(paper.totalBeforeGlobal, locale)}</strong>
                </div>
                <div className="discount-row">
                  <span>{tr(lang, 'Remise globale', 'Overall discount', 'الخصم العام')}</span>
                  <strong>- {formatTnd(paper.globalDiscount, locale)}</strong>
                </div>
              </>
            )}

            <div className="grand-total">
              <span>{tr(lang, 'Total TTC à payer', 'Total to pay incl. VAT', 'المبلغ للدفع شامل الأداء')}</span>
              <strong>{formatTnd(paper.total, locale)}</strong>
            </div>
          </div>
        </section>

        <section className="preview-shell">
          <div className="preview-toolbar">
            <FileText size={16} />
            <span>Aperçu A4 · {finalized ? finalized.number : 'FACTURE PROVISOIRE'}</span>
            <span className="preview-status">
              {finalized ? 'Document final' : 'Aperçu avant validation'}
            </span>
          </div>
          <InvoicePaper lang={lang} paper={paper} />
        </section>
      </div>

      {showPicker && (
        <PartPicker
          lang={lang}
          onClose={() => setShowPicker(false)}
          onSelect={addPart}
        />
      )}

      {showClientPicker && (
        <ClientPicker
          lang={lang}
          onClose={() => setShowClientPicker(false)}
          onSelect={(client) => {
            setSelectedClient(client)
            setCustomer(client.name)
            setCustomerPhone(client.phone ?? '')
            setCustomerAddress(client.address ?? '')
            setCustomerTaxId(client.taxId ?? '')
            setShowClientPicker(false)
          }}
        />
      )}
    </div>
  )
}

function ClientPicker({
  lang,
  onClose,
  onSelect
}: {
  lang: Language
  onClose: () => void
  onSelect: (client: Client) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const result = await window.desktop.clients.list(query)
        if (active) setClients(result)
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : tr(lang, 'Recherche client impossible.', 'Customer search failed.', 'تعذر البحث عن الحريف.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 120)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, lang])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card picker-card">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{t(lang, 'clients')}</span>
            <h2>{tr(lang, 'Choisir un client enregistré', 'Choose a saved customer', 'اختيار حريف مسجل')}</h2>
            <p>{tr(lang, 'Le nom, l’adresse et le matricule fiscal seront repris sur la facture.', 'The name, address and tax ID will be used on the invoice.', 'سيتم استعمال الاسم والعنوان والمعرّف الجبائي في الفاتورة.')}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="table-search picker-search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(lang, 'Nom, téléphone, matricule fiscal…', 'Name, phone, tax ID…', 'الاسم أو الهاتف أو المعرّف الجبائي…')}
          />
        </label>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="picker-results">
          {loading && <div className="panel-empty">{tr(lang, 'Recherche…', 'Searching…', 'جار البحث…')}</div>}
          {!loading && clients.map((client) => (
            <button
              className="picker-row"
              type="button"
              key={client.id}
              onClick={() => onSelect(client)}
            >
              <span>
                <strong>{client.name}</strong>
                <small>
                  {[client.phone, client.taxId ? `MF ${client.taxId}` : null]
                    .filter(Boolean)
                    .join(' · ') || tr(lang, 'Aucune coordonnée', 'No contact details', 'لا توجد بيانات اتصال')}
                </small>
              </span>
              <span className="picker-meta">
                <small>{client.address || tr(lang, 'Adresse non renseignée', 'Address not entered', 'العنوان غير مسجل')}</small>
              </span>
              <Plus size={18} />
            </button>
          ))}
          {!loading && clients.length === 0 && (
            <div className="panel-empty">{tr(lang, 'Aucun client trouvé.', 'No customer found.', 'لم يتم العثور على حريف.')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function PartPicker({
  lang,
  onClose,
  onSelect
}: {
  lang: Language
  onClose: () => void
  onSelect: (part: Part) => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const result = await window.desktop.parts.list(query)
        if (active) setParts(result)
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : tr(lang, 'Recherche impossible.', 'Search failed.', 'تعذر البحث.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 120)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, lang])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card picker-card">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{tr(lang, 'Catalogue', 'Catalogue', 'الدليل')}</span>
            <h2>{tr(lang, 'Ajouter une pièce à la facture', 'Add a part to the invoice', 'إضافة قطعة إلى الفاتورة')}</h2>
            <p>{tr(lang, 'Seules les pièces avec stock disponible peuvent être ajoutées.', 'Only parts currently in stock can be added.', 'يمكن إضافة القطع المتوفرة في المخزون فقط.')}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="table-search picker-search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(lang, 'Référence, OEM, désignation, véhicule…', 'Reference, OEM, description, vehicle…', 'المرجع أو OEM أو البيان أو السيارة…')}
          />
        </label>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="picker-results">
          {loading && <div className="panel-empty">{tr(lang, 'Recherche…', 'Searching…', 'جار البحث…')}</div>}

          {!loading && parts.filter((part) => part.quantity > 0).map((part) => (
            <button
              className="picker-row"
              type="button"
              key={part.id}
              onClick={() => onSelect(part)}
            >
              <span>
                <strong>{part.designation}</strong>
                <small>
                  {part.reference}
                  {part.oemReference ? ` · OEM ${part.oemReference}` : ''}
                  {' · '}
                  {part.vehicleCompatibility || tr(lang, 'Compatibilité non précisée', 'Compatibility not specified', 'التوافق غير محدد')}
                </small>
              </span>
              <span className="picker-meta">
                <strong>{formatTnd(part.salePriceMillimes, localeFor(lang))}</strong>
                <small>
                  {tr(lang, 'Stock', 'Stock', 'المخزون')}: {part.quantity} · {part.location || tr(lang, 'sans emplacement', 'no location', 'دون مكان')}
                </small>
              </span>
              <Plus size={18} />
            </button>
          ))}

          {!loading && parts.filter((part) => part.quantity > 0).length === 0 && (
            <div className="panel-empty">
              {tr(lang, 'Aucune pièce disponible pour cette recherche.', 'No available part matches this search.', 'لا توجد قطعة متوفرة تطابق هذا البحث.')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InvoicePaper({
  lang,
  paper
}: {
  lang: Language
  paper: {
    number: string
    finalizedAt: string | null
    customerName: string
    customerPhone: string | null
    customerAddress: string | null
    customerTaxId: string | null
    notes: string | null
    subtotalGrossHt: number
    lineDiscount: number
    netHt: number
    vat: number
    totalBeforeGlobal: number
    globalDiscount: number
    total: number
    taxPercent: number
    business: BusinessSettings
    lines: Array<{
      id: string
      ref: string
      designation: string
      qty: number
      listUnitPriceMillimes: number
      clientUnitPriceMillimes: number
      discountMillimes: number
      lineHtMillimes: number
    }>
  }
}): JSX.Element {
  const locale = localeFor(lang)
  const dateText = paper.finalizedAt
    ? new Date(paper.finalizedAt.replace(' ', 'T') + 'Z').toLocaleString(
        locale,
        { dateStyle: 'short', timeStyle: 'short' }
      )
    : new Date().toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      })

  return (
    <article className="invoice-paper">
      <header className="paper-header">
        <div className="paper-brand">
          <BrandLogo className="paper-logo" />
          <div>
            <strong>{paper.business.companyName.toUpperCase()}</strong>
            <span>{paper.business.activity.toUpperCase()}</span>
            <small>{[paper.business.companyNameAr, paper.business.activityAr].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <div className="paper-title">
          <span>FACTURE</span>
          <strong>N° {paper.number}</strong>
          <small>Date : {dateText}</small>
        </div>
      </header>

      <div className="paper-meta">
        <div>
          <span className="paper-label">CLIENT</span>
          <strong>{paper.customerName || 'Client comptoir'}</strong>
          {paper.customerPhone && <small>Tél: {paper.customerPhone}</small>}
          {paper.customerAddress && <small>{paper.customerAddress}</small>}
          {paper.customerTaxId && <small>MF: {paper.customerTaxId}</small>}
        </div>
        <div>
          <span className="paper-label">ÉTABLISSEMENT</span>
          <strong>{paper.business.address}</strong>
          <small>
            {[paper.business.phone1, paper.business.phone2].filter(Boolean).join(' / ')}
            {paper.business.taxId ? ` · MF ${paper.business.taxId}` : ''}
          </small>
        </div>
      </div>

      <table className="paper-table discount-paper-table">
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Désignation</th>
            <th className="number">Qté</th>
            <th className="number">Prix unit. HT</th>
            <th className="number">Remise/u</th>
            <th className="number">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {paper.lines.length === 0 ? (
            <tr>
              <td colSpan={6} className="paper-empty">
                Ajoutez des articles pour prévisualiser la facture.
              </td>
            </tr>
          ) : paper.lines.map((line) => {
            const unitDiscount =
              line.listUnitPriceMillimes - line.clientUnitPriceMillimes

            return (
              <tr key={line.id}>
                <td>{line.ref}</td>
                <td>{line.designation}</td>
                <td className="number">{line.qty}</td>
                <td className="number">
                  {formatTnd(line.clientUnitPriceMillimes, locale)}
                </td>
                <td className="number">
                  {unitDiscount > 0
                    ? `- ${formatTnd(unitDiscount, locale)} /u`
                    : '—'}
                </td>
                <td className="number">
                  {formatTnd(line.lineHtMillimes, locale)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="paper-bottom">
        <div className="paper-note">
          <span className="paper-label">NOTE</span>
          <p>{paper.notes || 'Merci pour votre confiance.'}</p>
          <small>
            {paper.number === 'PROVISOIRE'
              ? 'Aperçu non comptabilisé — les remises peuvent encore être modifiées.'
              : 'Document final: les prix et remises sont figés.'}
          </small>
        </div>

        <div className="paper-totals">
          <div>
            <span>Total HT catalogue</span>
            <strong>{formatTnd(paper.subtotalGrossHt, locale)}</strong>
          </div>

          {paper.lineDiscount > 0 && (
            <div className="paper-discount">
              <span>Remises articles</span>
              <strong>- {formatTnd(paper.lineDiscount, locale)}</strong>
            </div>
          )}

          <div>
            <span>Total HT net</span>
            <strong>{formatTnd(paper.netHt, locale)}</strong>
          </div>
          <div>
            <span>TVA {paper.taxPercent}%</span>
            <strong>{formatTnd(paper.vat, locale)}</strong>
          </div>

          {paper.globalDiscount > 0 && (
            <>
              <div>
                <span>Sous-total TTC</span>
                <strong>{formatTnd(paper.totalBeforeGlobal, locale)}</strong>
              </div>
              <div className="paper-discount">
                <span>Remise globale</span>
                <strong>- {formatTnd(paper.globalDiscount, locale)}</strong>
              </div>
            </>
          )}

          <div className="paper-grand-total">
            <span>Total TTC à payer</span>
            <strong>{formatTnd(paper.total, locale)}</strong>
          </div>
        </div>
      </div>

      <footer className="paper-footer">
        <span>{paper.business.companyName.toUpperCase()} · {paper.business.activity.toUpperCase()}</span>
        <span>
          {paper.business.address} · {[paper.business.phone1, paper.business.phone2].filter(Boolean).join(' · ')}
        </span>
      </footer>
    </article>
  )
}

function calculateDraft(
  lines: DraftLine[],
  mode: AdjustmentMode,
  adjustmentText: string,
  taxPercent: number
): DraftCalculation {
  let subtotalGrossHt = 0
  let lineDiscount = 0
  let netHt = 0
  let vat = 0
  let priceError: string | null = null

  for (const line of lines) {
    const clientUnit = parseTnd(line.clientUnitPriceText)

    if (clientUnit === null) {
      priceError = `Prix client invalide pour ${line.ref}.`
      continue
    }

    if (clientUnit > line.listUnitPriceMillimes) {
      priceError = `Le prix client de ${line.ref} ne peut pas dépasser le prix catalogue.`
      continue
    }

    subtotalGrossHt += line.listUnitPriceMillimes * line.qty
    const lineNet = clientUnit * line.qty
    netHt += lineNet
    lineDiscount +=
      (line.listUnitPriceMillimes - clientUnit) * line.qty
    vat += percentageAmount(lineNet, taxPercent)
  }

  const totalBeforeGlobal = netHt + vat
  const adjustmentValue =
    adjustmentText.trim() === '' ? null : parseTnd(adjustmentText)

  let globalDiscount = 0
  let adjustmentError: string | null = null

  if (adjustmentText.trim() !== '' && adjustmentValue === null) {
    adjustmentError = 'Montant de remise ou total final invalide.'
  } else if (adjustmentValue !== null) {
    if (mode === 'target') {
      if (adjustmentValue > totalBeforeGlobal) {
        adjustmentError =
          'Le total final ne peut pas dépasser le total actuel. Effacez le champ si vous ne voulez pas de remise.'
      } else {
        globalDiscount = totalBeforeGlobal - adjustmentValue
      }
    } else if (adjustmentValue > totalBeforeGlobal) {
      adjustmentError = 'La remise globale ne peut pas dépasser le total de la facture.'
    } else {
      globalDiscount = adjustmentValue
    }
  }

  return {
    valid: priceError === null && adjustmentError === null,
    priceError,
    subtotalGrossHt,
    lineDiscount,
    netHt,
    vat,
    totalBeforeGlobal,
    globalDiscount,
    total: Math.max(0, totalBeforeGlobal - globalDiscount),
    adjustmentValue,
    adjustmentError
  }
}

function invoiceContentFingerprint(input: {
  customer: string
  customerPhone: string
  customerAddress: string
  customerTaxId: string
  notes: string
  adjustmentMode: AdjustmentMode
  adjustmentText: string
  lines: DraftLine[]
}): string {
  return JSON.stringify({
    customer: input.customer.trim(),
    customerPhone: input.customerPhone.trim(),
    customerAddress: input.customerAddress.trim(),
    customerTaxId: input.customerTaxId.trim(),
    notes: input.notes.trim(),
    adjustmentMode: input.adjustmentMode,
    adjustmentText: input.adjustmentText.trim(),
    lines: input.lines.map((line) => ({
      partId: line.partId,
      ref: line.ref,
      designation: line.designation,
      qty: line.qty,
      listUnitPriceMillimes: line.listUnitPriceMillimes,
      clientUnitPriceText: line.clientUnitPriceText
    }))
  })
}

function formatDraftDate(value: string, locale: string): string {
  const parsed = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      })
}

function fallbackBusinessSettings(): BusinessSettings {
  return {
    companyName: 'Etablissement Ben Mahmoud',
    activity: 'Équipement Automobiles',
    companyNameAr: 'مؤسسة بن محمود',
    activityAr: 'تجهيز السيارات',
    address: '31, Rue Chedly Kallala, 1002 Tunis',
    phone1: '71 801 813',
    phone2: '29 276 853',
    taxId: '',
    defaultTaxPercent: 19,
    invoicePrefix: 'F',
    invoiceDigits: 4,
    defaultCustomerName: 'Client comptoir'
  }
}

function editableTnd(millimes: number): string {
  return (millimes / 1000).toFixed(3)
}

function parseTnd(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(?:\.\d{0,3})?$/.test(normalized)) return null

  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) return null

  return Math.round(amount * 1000)
}

function isEditableMoney(value: string): boolean {
  const normalized = value.replace(',', '.')
  return normalized === '' || /^\d*(?:\.\d{0,3})?$/.test(normalized)
}
