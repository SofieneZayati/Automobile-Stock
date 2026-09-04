import { useEffect, useMemo, useState, type JSX } from 'react'
import { CheckCircle2, FileText, Plus, Printer, RotateCcw, Save, Search, Trash2, X } from 'lucide-react'
import type { FinalizedInvoice, Part } from '../../../shared/contracts'
import { Language, localeFor, t } from '../i18n'
import { formatTnd, lineTotal, percentageAmount } from '../lib/money'

type DraftLine = {
  id: string
  partId: number
  ref: string
  designation: string
  stockAvailable: number
  qty: number
  unitPriceMillimes: number
}

export function Invoices({ lang }: { lang: Language }): JSX.Element {
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customer, setCustomer] = useState(t(lang, 'walkIn'))
  const [showPicker, setShowPicker] = useState(false)
  const [finalized, setFinalized] = useState<FinalizedInvoice | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')
  const locale = localeFor(lang)

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line.qty, line.unitPriceMillimes), 0), [lines])
  const vat = percentageAmount(subtotal, 19)
  const total = subtotal + vat

  function updateQty(id: string, qty: number): void {
    setLines((current) => current.map((line) => line.id === id
      ? { ...line, qty: Math.max(1, Math.min(line.stockAvailable, qty || 1)) }
      : line
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
        unitPriceMillimes: part.salePriceMillimes
      }]
    })
    setShowPicker(false)
  }

  async function finalize(): Promise<void> {
    if (lines.length === 0) {
      setError('Ajoutez au moins une pièce avant de valider la facture.')
      return
    }

    try {
      setFinalizing(true)
      setError('')
      const result = await window.desktop.invoices.finalize({
        customerName: customer,
        lines: lines.map((line) => ({
          partId: line.partId,
          reference: line.ref,
          designation: line.designation,
          quantity: line.qty,
          unitPriceHtMillimes: line.unitPriceMillimes,
          taxPercent: 19
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
    setCustomer(t(lang, 'walkIn'))
    setFinalized(null)
    setError('')
  }

  const paper = finalized
    ? {
        number: finalized.number,
        finalizedAt: finalized.finalizedAt,
        customerName: finalized.customerName,
        subtotal: finalized.subtotalHtMillimes,
        vat: finalized.taxMillimes,
        total: finalized.totalTtcMillimes,
        lines: finalized.lines.map((line, index) => ({
          id: `final-${index}`,
          ref: line.reference,
          designation: line.designation,
          qty: line.quantity,
          unitPriceMillimes: line.unitPriceHtMillimes,
          lineHtMillimes: line.lineHtMillimes
        }))
      }
    : {
        number: 'PROVISOIRE',
        finalizedAt: null,
        customerName: customer,
        subtotal,
        vat,
        total,
        lines: lines.map((line) => ({
          id: line.id,
          ref: line.ref,
          designation: line.designation,
          qty: line.qty,
          unitPriceMillimes: line.unitPriceMillimes,
          lineHtMillimes: lineTotal(line.qty, line.unitPriceMillimes)
        }))
      }

  return (
    <div className="page invoice-page">
      <section className="page-heading invoice-heading">
        <div>
          <span className="eyebrow">Facturation · Stock connecté</span>
          <h1>{finalized ? `Facture ${finalized.number}` : t(lang, 'invoiceDraft')}</h1>
          <p>{finalized ? 'La facture est finalisée et le stock a été décrémenté.' : 'Préparez la vente à gauche. Contrôlez exactement ce qui sera imprimé à droite.'}</p>
        </div>
        <div className="heading-actions">
          {finalized ? (
            <>
              <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={18} />Imprimer</button>
              <button className="primary-button" type="button" onClick={newInvoice}><RotateCcw size={18} />Nouvelle facture</button>
            </>
          ) : (
            <>
              <button className="secondary-button" type="button" disabled><Save size={18} />{t(lang, 'saveDraft')}</button>
              <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={18} />{t(lang, 'print')}</button>
              <button className="primary-button" type="button" onClick={() => void finalize()} disabled={finalizing || lines.length === 0}><CheckCircle2 size={18} />{finalizing ? 'Validation…' : t(lang, 'finalize')}</button>
            </>
          )}
        </div>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => setError('')}>Fermer</button></div>}
      {finalized && <div className="inline-alert success"><CheckCircle2 size={18} />Facture {finalized.number} enregistrée. Les mouvements de stock sont maintenant figés.</div>}

      <div className="invoice-workspace">
        <section className={finalized ? 'invoice-editor panel locked' : 'invoice-editor panel'}>
          <div className="editor-section">
            <div className="section-label"><span>01</span><div><strong>{t(lang, 'customer')}</strong><small>Facultatif pour une vente au comptoir</small></div></div>
            <label className="field">
              <span>Nom / société</span>
              <input value={finalized?.customerName ?? customer} onChange={(e) => setCustomer(e.target.value)} disabled={Boolean(finalized)} />
            </label>
          </div>

          <div className="editor-section">
            <div className="section-label"><span>02</span><div><strong>Articles</strong><small>La disponibilité est contrôlée de nouveau au moment de la validation</small></div></div>
            {!finalized && (
              <button className="part-search-button" type="button" onClick={() => setShowPicker(true)}>
                <Search size={18} /><span>Rechercher par référence, OEM, désignation ou véhicule…</span><kbd>F2</kbd>
              </button>
            )}

            <div className="editor-lines">
              {lines.length === 0 && !finalized && <div className="editor-empty">Aucune ligne. Recherchez une pièce pour commencer la facture.</div>}
              {(finalized ? paper.lines : lines.map((line) => ({
                id: line.id,
                ref: line.ref,
                designation: line.designation,
                qty: line.qty,
                unitPriceMillimes: line.unitPriceMillimes,
                stockAvailable: line.stockAvailable
              }))).map((line) => (
                <div className="editor-line" key={line.id}>
                  <div className="line-main"><strong>{line.designation}</strong><small>{line.ref}{'stockAvailable' in line ? ` · stock ${line.stockAvailable}` : ''}</small></div>
                  <label className="qty-control"><span>Qté</span><input type="number" min="1" max={'stockAvailable' in line ? line.stockAvailable : line.qty} value={line.qty} disabled={Boolean(finalized)} onChange={(e) => updateQty(line.id, Number(e.target.value))} /></label>
                  <div className="line-price"><span>PU HT</span><strong>{formatTnd(line.unitPriceMillimes, locale)}</strong></div>
                  <div className="line-price"><span>Total HT</span><strong>{formatTnd(lineTotal(line.qty, line.unitPriceMillimes), locale)}</strong></div>
                  {!finalized ? <button className="icon-button danger-button" type="button" onClick={() => removeLine(line.id)}><Trash2 size={17} /></button> : <span />}
                </div>
              ))}
            </div>

            {!finalized && <button className="add-line-button" type="button" onClick={() => setShowPicker(true)}><Plus size={17} />Ajouter une ligne</button>}
          </div>

          <div className="editor-summary">
            <div><span>Sous-total HT</span><strong>{formatTnd(paper.subtotal, locale)}</strong></div>
            <div><span>TVA 19%</span><strong>{formatTnd(paper.vat, locale)}</strong></div>
            <div className="grand-total"><span>Total TTC</span><strong>{formatTnd(paper.total, locale)}</strong></div>
          </div>
        </section>

        <section className="preview-shell">
          <div className="preview-toolbar"><FileText size={16} /><span>Aperçu A4 · {finalized ? finalized.number : 'FACTURE PROVISOIRE'}</span><span className="preview-status">{finalized ? 'Document final' : 'Aperçu avant validation'}</span></div>
          <InvoicePaper lang={lang} paper={paper} />
        </section>
      </div>

      {showPicker && <PartPicker lang={lang} onClose={() => setShowPicker(false)} onSelect={addPart} />}
    </div>
  )
}

function PartPicker({ lang, onClose, onSelect }: { lang: Language; onClose: () => void; onSelect: (part: Part) => void }): JSX.Element {
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
        if (active) setError(cause instanceof Error ? cause.message : 'Recherche impossible.')
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
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card picker-card">
        <div className="modal-heading">
          <div><span className="eyebrow">Catalogue</span><h2>Ajouter une pièce à la facture</h2><p>Seules les pièces avec stock disponible peuvent être ajoutées.</p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <label className="table-search picker-search"><Search size={18} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Référence, OEM, désignation, véhicule…" /></label>
        {error && <div className="inline-alert error">{error}</div>}

        <div className="picker-results">
          {loading && <div className="panel-empty">Recherche…</div>}
          {!loading && parts.filter((part) => part.quantity > 0).map((part) => (
            <button className="picker-row" type="button" key={part.id} onClick={() => onSelect(part)}>
              <span><strong>{part.designation}</strong><small>{part.reference}{part.oemReference ? ` · OEM ${part.oemReference}` : ''} · {part.vehicleCompatibility || 'Compatibilité non précisée'}</small></span>
              <span className="picker-meta"><strong>{formatTnd(part.salePriceMillimes, localeFor(lang))}</strong><small>Stock: {part.quantity} · {part.location || 'sans emplacement'}</small></span>
              <Plus size={18} />
            </button>
          ))}
          {!loading && parts.filter((part) => part.quantity > 0).length === 0 && <div className="panel-empty">Aucune pièce disponible pour cette recherche.</div>}
        </div>
      </div>
    </div>
  )
}

function InvoicePaper({ lang, paper }: {
  lang: Language
  paper: {
    number: string
    finalizedAt: string | null
    customerName: string
    subtotal: number
    vat: number
    total: number
    lines: Array<{
      id: string
      ref: string
      designation: string
      qty: number
      unitPriceMillimes: number
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
            <strong>ETABLISSEMENT BEN MAHMOUD</strong>
            <span>ÉQUIPEMENT AUTOMOBILES</span>
            <small>مؤسسة بن محمود · تجهيز السيارات</small>
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
          <strong>31, Rue Chedly Kallala · 1002 Tunis</strong>
          <small>Tél. 71 801 813 / 29 276 853</small>
        </div>
      </div>

      <table className="paper-table">
        <thead><tr><th>Réf.</th><th>Désignation</th><th className="number">Qté</th><th className="number">P.U. HT</th><th className="number">Montant HT</th></tr></thead>
        <tbody>
          {paper.lines.length === 0 ? (
            <tr><td colSpan={5} className="paper-empty">Ajoutez des articles pour prévisualiser la facture.</td></tr>
          ) : paper.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.ref}</td>
              <td>{line.designation}</td>
              <td className="number">{line.qty}</td>
              <td className="number">{formatTnd(line.unitPriceMillimes, locale)}</td>
              <td className="number">{formatTnd(line.lineHtMillimes, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="paper-bottom">
        <div className="paper-note">
          <span className="paper-label">NOTE</span>
          <p>Merci pour votre confiance.</p>
          <small>{paper.number === 'PROVISOIRE' ? 'Aperçu non comptabilisé — validez la facture pour obtenir un numéro.' : 'Document enregistré dans Ben Mahmoud Stock.'}</small>
        </div>
        <div className="paper-totals">
          <div><span>Total HT</span><strong>{formatTnd(paper.subtotal, locale)}</strong></div>
          <div><span>TVA 19%</span><strong>{formatTnd(paper.vat, locale)}</strong></div>
          <div className="paper-grand-total"><span>Total TTC</span><strong>{formatTnd(paper.total, locale)}</strong></div>
        </div>
      </div>

      <footer className="paper-footer">
        <span>ETABLISSEMENT BEN MAHMOUD · ÉQUIPEMENT AUTOMOBILES</span>
        <span>31, Rue Chedly Kallala, 1002 Tunis · 71 801 813 · 29 276 853</span>
      </footer>
    </article>
  )
}
