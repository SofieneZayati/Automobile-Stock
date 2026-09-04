import { CheckCircle2, FileText, Plus, Printer, Save, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { parts } from '../data/mock'
import { Language, localeFor, t } from '../i18n'
import { formatTnd, lineTotal, percentageAmount } from '../lib/money'

type Line = {
  id: number
  ref: string
  designation: string
  qty: number
  unitPriceMillimes: number
}

const initialLines: Line[] = [
  { id: 1, ref: 'BM-REN-027', designation: 'Plaquettes de frein avant — Renault Clio IV', qty: 1, unitPriceMillimes: 68000 },
  { id: 2, ref: 'BM-PEU-014', designation: 'Filtre à huile — Peugeot / Citroën', qty: 2, unitPriceMillimes: 12500 }
]

export function Invoices({ lang }: { lang: Language }): JSX.Element {
  const [lines, setLines] = useState<Line[]>(initialLines)
  const [customer, setCustomer] = useState(t(lang, 'walkIn'))
  const locale = localeFor(lang)

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line.qty, line.unitPriceMillimes), 0), [lines])
  const vat = percentageAmount(subtotal, 19)
  const total = subtotal + vat

  function updateQty(id: number, qty: number): void {
    setLines((current) => current.map((line) => line.id === id ? { ...line, qty: Math.max(1, qty || 1) } : line))
  }

  function removeLine(id: number): void {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  function addSamplePart(): void {
    const part = parts.find((candidate) => !lines.some((line) => line.ref === candidate.ref))
    if (!part) return
    setLines((current) => [...current, {
      id: Date.now(),
      ref: part.ref,
      designation: `${part.designation} — ${part.vehicle}`,
      qty: 1,
      unitPriceMillimes: part.priceMillimes
    }])
  }

  return (
    <div className="page invoice-page">
      <section className="page-heading invoice-heading">
        <div>
          <span className="eyebrow">Facturation</span>
          <h1>{t(lang, 'invoiceDraft')}</h1>
          <p>Préparez la vente à gauche. Contrôlez exactement ce qui sera imprimé à droite.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button"><Save size={18} />{t(lang, 'saveDraft')}</button>
          <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={18} />{t(lang, 'print')}</button>
          <button className="primary-button" type="button"><CheckCircle2 size={18} />{t(lang, 'finalize')}</button>
        </div>
      </section>

      <div className="invoice-workspace">
        <section className="invoice-editor panel">
          <div className="editor-section">
            <div className="section-label"><span>01</span><div><strong>{t(lang, 'customer')}</strong><small>Facultatif pour une vente au comptoir</small></div></div>
            <label className="field">
              <span>Nom / société</span>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </label>
          </div>

          <div className="editor-section">
            <div className="section-label"><span>02</span><div><strong>Articles</strong><small>La disponibilité reste visible avant validation</small></div></div>
            <button className="part-search-button" type="button" onClick={addSamplePart}>
              <Search size={18} /><span>Rechercher par référence ou désignation…</span><kbd>F2</kbd>
            </button>

            <div className="editor-lines">
              {lines.map((line) => (
                <div className="editor-line" key={line.id}>
                  <div className="line-main"><strong>{line.designation}</strong><small>{line.ref}</small></div>
                  <label className="qty-control"><span>Qté</span><input type="number" min="1" value={line.qty} onChange={(e) => updateQty(line.id, Number(e.target.value))} /></label>
                  <div className="line-price"><span>PU</span><strong>{formatTnd(line.unitPriceMillimes, locale)}</strong></div>
                  <div className="line-price"><span>Total</span><strong>{formatTnd(lineTotal(line.qty, line.unitPriceMillimes), locale)}</strong></div>
                  <button className="icon-button danger-button" type="button" onClick={() => removeLine(line.id)}><Trash2 size={17} /></button>
                </div>
              ))}
            </div>

            <button className="add-line-button" type="button" onClick={addSamplePart}><Plus size={17} />Ajouter une ligne</button>
          </div>

          <div className="editor-summary">
            <div><span>Sous-total HT</span><strong>{formatTnd(subtotal, locale)}</strong></div>
            <div><span>TVA 19%</span><strong>{formatTnd(vat, locale)}</strong></div>
            <div className="grand-total"><span>Total TTC</span><strong>{formatTnd(total, locale)}</strong></div>
          </div>
        </section>

        <section className="preview-shell">
          <div className="preview-toolbar"><FileText size={16} /><span>Aperçu A4 · FACTURE PROVISOIRE</span><span className="preview-status">Prêt à imprimer</span></div>
          <InvoicePaper lang={lang} customer={customer} lines={lines} subtotal={subtotal} vat={vat} total={total} />
        </section>
      </div>
    </div>
  )
}

function InvoicePaper({ lang, customer, lines, subtotal, vat, total }: {
  lang: Language
  customer: string
  lines: Line[]
  subtotal: number
  vat: number
  total: number
}): JSX.Element {
  const locale = localeFor(lang)
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
          <strong>F-2026-0049</strong>
          <small>04/09/2026 · 20:04</small>
        </div>
      </header>

      <div className="paper-meta">
        <div>
          <span className="paper-label">CLIENT</span>
          <strong>{customer || 'Client comptoir'}</strong>
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
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.ref}</td>
              <td>{line.designation}</td>
              <td className="number">{line.qty}</td>
              <td className="number">{formatTnd(line.unitPriceMillimes, locale)}</td>
              <td className="number">{formatTnd(lineTotal(line.qty, line.unitPriceMillimes), locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="paper-bottom">
        <div className="paper-note">
          <span className="paper-label">NOTE</span>
          <p>Merci pour votre confiance.</p>
          <small>Document généré par Ben Mahmoud Stock.</small>
        </div>
        <div className="paper-totals">
          <div><span>Total HT</span><strong>{formatTnd(subtotal, locale)}</strong></div>
          <div><span>TVA 19%</span><strong>{formatTnd(vat, locale)}</strong></div>
          <div className="paper-grand-total"><span>Total TTC</span><strong>{formatTnd(total, locale)}</strong></div>
        </div>
      </div>

      <footer className="paper-footer">
        <span>ETABLISSEMENT BEN MAHMOUD · ÉQUIPEMENT AUTOMOBILES</span>
        <span>31, Rue Chedly Kallala, 1002 Tunis · 71 801 813 · 29 276 853</span>
      </footer>
    </article>
  )
}
