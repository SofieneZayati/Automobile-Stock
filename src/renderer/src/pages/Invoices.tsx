import { useEffect, useMemo, useState, type JSX } from 'react'
import {
  CheckCircle2,
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
import type { BusinessSettings, FinalizedInvoice, Part } from '../../../shared/contracts'
import { Language, localeFor, t } from '../i18n'
import { formatTnd, percentageAmount } from '../lib/money'

type DraftLine = {
  id: string
  partId: number
  ref: string
  designation: string
  stockAvailable: number
  qty: number
  listUnitPriceMillimes: number
  clientUnitPriceText: string
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

export function Invoices({ lang }: { lang: Language }): JSX.Element {
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customer, setCustomer] = useState(t(lang, 'walkIn'))
  const [showPicker, setShowPicker] = useState(false)
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

  const calculation = useMemo(
    () => calculateDraft(lines, adjustmentMode, adjustmentText, taxPercent),
    [lines, adjustmentMode, adjustmentText, taxPercent]
  )

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

      const adjustmentValue = calculation.adjustmentValue
      const result = await window.desktop.invoices.finalize({
        customerName: customer,
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
      })

      setFinalized(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de finaliser la facture.')
    } finally {
      setFinalizing(false)
    }
  }

  function newInvoice(): void {
    setLines([])
    setCustomer(business?.defaultCustomerName ?? t(lang, 'walkIn'))
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
          <span className="eyebrow">Facturation · Prix négociables avant validation</span>
          <h1>{finalized ? `Facture ${finalized.number}` : t(lang, 'invoiceDraft')}</h1>
          <p>
            {finalized
              ? 'La facture est finalisée et les prix/remises sont maintenant figés.'
              : 'Modifiez le prix d’une pièce ou arrondissez directement le total avant de valider.'}
          </p>
        </div>
        <div className="heading-actions">
          {finalized ? (
            <>
              <button className="secondary-button" type="button" onClick={() => window.print()}>
                <Printer size={18} />Imprimer
              </button>
              <button className="primary-button" type="button" onClick={newInvoice}>
                <RotateCcw size={18} />Nouvelle facture
              </button>
            </>
          ) : (
            <>
              <button className="secondary-button" type="button" disabled>
                <Save size={18} />{t(lang, 'saveDraft')}
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
                {finalizing ? 'Validation…' : t(lang, 'finalize')}
              </button>
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>Fermer</button>
        </div>
      )}

      {finalized && (
        <div className="inline-alert success">
          <CheckCircle2 size={18} />
          Facture {finalized.number} enregistrée avec ses remises. Les mouvements de stock sont figés.
        </div>
      )}

      <div className="invoice-workspace">
        <section className={finalized ? 'invoice-editor panel locked' : 'invoice-editor panel'}>
          <div className="editor-section">
            <div className="section-label">
              <span>01</span>
              <div>
                <strong>{t(lang, 'customer')}</strong>
                <small>Facultatif pour une vente au comptoir</small>
              </div>
            </div>
            <label className="field">
              <span>Nom / société</span>
              <input
                value={finalized?.customerName ?? customer}
                onChange={(event) => setCustomer(event.target.value)}
                disabled={Boolean(finalized)}
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="section-label">
              <span>02</span>
              <div>
                <strong>Articles & prix client</strong>
                <small>Le prix catalogue reste visible; vous pouvez saisir le prix réellement accordé.</small>
              </div>
            </div>

            {!finalized && (
              <button className="part-search-button" type="button" onClick={() => setShowPicker(true)}>
                <Search size={18} />
                <span>Rechercher par référence, OEM, désignation ou véhicule…</span>
                <kbd>F2</kbd>
              </button>
            )}

            <div className="editor-lines negotiated-lines">
              {lines.length === 0 && !finalized && (
                <div className="editor-empty">
                  Aucune ligne. Recherchez une pièce pour commencer la facture.
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
                      <span>Qté</span>
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
                      <span>Catalogue HT</span>
                      <strong>{formatTnd(listPrice, locale)}</strong>
                    </div>

                    <label className={hasDiscount ? 'negotiated-price discounted' : 'negotiated-price'}>
                      <span>Prix client HT</span>
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
                      <span>Total HT</span>
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
                <Plus size={17} />Ajouter une ligne
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
                <strong>Remise sur le total</strong>
                <small>
                  Exemple: si le total est 205 DT, choisissez “Total final” et saisissez 200.
                </small>
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
                    Total final
                  </button>
                  <button
                    type="button"
                    className={adjustmentMode === 'discount' ? 'active' : ''}
                    onClick={() => { setAdjustmentMode('discount'); setAdjustmentText('') }}
                  >
                    Remise DT
                  </button>
                </div>

                <label className="adjustment-input">
                  <span>
                    {adjustmentMode === 'target'
                      ? 'Total TTC souhaité'
                      : 'Remise globale TTC'}
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
                    <span>Remise globale calculée</span>
                    <strong>{formatTnd(calculation.globalDiscount, locale)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="locked-discount-summary">
                <span>Remise globale enregistrée</span>
                <strong>{formatTnd(finalized.globalDiscountTtcMillimes, locale)}</strong>
              </div>
            )}

            {!finalized && calculation.adjustmentError && (
              <div className="price-validation">{calculation.adjustmentError}</div>
            )}
          </div>

          <div className="editor-summary invoice-discount-summary">
            <div>
              <span>Total HT catalogue</span>
              <strong>{formatTnd(paper.subtotalGrossHt, locale)}</strong>
            </div>

            {paper.lineDiscount > 0 && (
              <div className="discount-row">
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
                <div className="discount-row">
                  <span>Remise globale</span>
                  <strong>- {formatTnd(paper.globalDiscount, locale)}</strong>
                </div>
              </>
            )}

            <div className="grand-total">
              <span>Total TTC à payer</span>
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
          setError(cause instanceof Error ? cause.message : 'Recherche impossible.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 120)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query])

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
            <span className="eyebrow">Catalogue</span>
            <h2>Ajouter une pièce à la facture</h2>
            <p>Seules les pièces avec stock disponible peuvent être ajoutées.</p>
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
            placeholder="Référence, OEM, désignation, véhicule…"
          />
        </label>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="picker-results">
          {loading && <div className="panel-empty">Recherche…</div>}

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
                  {part.vehicleCompatibility || 'Compatibilité non précisée'}
                </small>
              </span>
              <span className="picker-meta">
                <strong>{formatTnd(part.salePriceMillimes, localeFor(lang))}</strong>
                <small>
                  Stock: {part.quantity} · {part.location || 'sans emplacement'}
                </small>
              </span>
              <Plus size={18} />
            </button>
          ))}

          {!loading && parts.filter((part) => part.quantity > 0).length === 0 && (
            <div className="panel-empty">
              Aucune pièce disponible pour cette recherche.
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
    ? new Date(paper.finalizedAt + 'Z').toLocaleString(locale)
    : new Date().toLocaleString(locale)

  return (
    <article className="invoice-paper">
      <header className="paper-header">
        <div className="paper-brand">
          <div className="paper-mark">BM</div>
          <div>
            <strong>{paper.business.companyName.toUpperCase()}</strong>
            <span>{paper.business.activity.toUpperCase()}</span>
            <small>{[paper.business.companyNameAr, paper.business.activityAr].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <div className="paper-title">
          <span>FACTURE</span>
          <strong>{paper.number}</strong>
          <small>{dateText}</small>
        </div>
      </header>

      <div className="paper-meta">
        <div>
          <span className="paper-label">CLIENT</span>
          <strong>{paper.customerName || 'Client comptoir'}</strong>
          <small>Tunis, Tunisie</small>
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
            <th className="number">P.U. client HT</th>
            <th className="number">Remise</th>
            <th className="number">Montant HT</th>
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
          <p>Merci pour votre confiance.</p>
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
