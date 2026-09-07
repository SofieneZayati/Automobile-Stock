import type { JSX } from 'react'
import { Printer, X } from 'lucide-react'
import type { BusinessSettings } from '../../../shared/contracts'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'

const testLines = Array.from({ length: 36 }, (_, index) => {
  const number = index + 1
  const unit = 12500 + (index % 7) * 2750
  const quantity = (index % 3) + 1
  return {
    ref: `TEST-${String(number).padStart(3, '0')}`,
    designation:
      number % 4 === 0
        ? `Pièce automobile de test avec une désignation volontairement longue pour vérifier le retour à la ligne et la lisibilité sur plusieurs pages — ligne ${number}`
        : `Pièce automobile de test — ligne ${number}`,
    quantity,
    unit,
    lineHt: unit * quantity
  }
})

export function PrintTestInvoice({
  business,
  lang,
  onClose
}: {
  business: BusinessSettings
  lang: Language
  onClose: () => void
}): JSX.Element {
  const locale = localeFor(lang)
  const subtotal = testLines.reduce((sum, line) => sum + line.lineHt, 0)
  const tax = Math.round(subtotal * business.defaultTaxPercent / 100)
  const total = subtotal + tax

  return (
    <div
      className="modal-backdrop invoice-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="invoice-preview-modal print-test-modal">
        <div className="invoice-preview-actions">
          <div>
            <span className="eyebrow">Test imprimante</span>
            <strong>A4 · 36 lignes · plusieurs pages</strong>
          </div>
          <div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Imprimer le test
            </button>
            <button className="icon-button" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="history-paper-shell">
          <article className="invoice-paper print-test-paper">
            <header className="paper-header">
              <div className="paper-brand">
                <div className="paper-mark">BM</div>
                <div>
                  <strong>{business.companyName.toUpperCase()}</strong>
                  <span>{business.activity.toUpperCase()}</span>
                  <small>
                    {[business.companyNameAr, business.activityAr]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
              </div>

              <div className="paper-title">
                <span>FACTURE TEST</span>
                <strong>TEST-IMPRESSION</strong>
                <small>{new Date().toLocaleString(locale)}</small>
              </div>
            </header>

            <div className="paper-test-banner">
              <strong>TEST IMPRESSION — DOCUMENT NON COMPTABILISÉ</strong>
              <span>
                Ce document sert uniquement à vérifier l’imprimante, les sauts
                de page, les descriptions longues et le bloc des totaux.
              </span>
            </div>

            <div className="paper-meta">
              <div>
                <span className="paper-label">CLIENT</span>
                <strong>CLIENT TEST IMPRESSION</strong>
                <small>Adresse de test — ne pas comptabiliser</small>
              </div>
              <div>
                <span className="paper-label">ÉTABLISSEMENT</span>
                <strong>{business.address}</strong>
                <small>
                  {[business.phone1, business.phone2]
                    .filter(Boolean)
                    .join(' / ')}
                  {business.taxId ? ` · MF ${business.taxId}` : ''}
                </small>
              </div>
            </div>

            <table className="paper-table print-test-table">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Désignation</th>
                  <th className="number">Qté</th>
                  <th className="number">P.U. HT</th>
                  <th className="number">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {testLines.map((line) => (
                  <tr key={line.ref}>
                    <td>{line.ref}</td>
                    <td>{line.designation}</td>
                    <td className="number">{line.quantity}</td>
                    <td className="number">{formatTnd(line.unit, locale)}</td>
                    <td className="number">
                      {formatTnd(line.lineHt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="paper-bottom">
              <div className="paper-note">
                <span className="paper-label">CONTRÔLE</span>
                <p>
                  Vérifier que les en-têtes se répètent, que les longues
                  désignations restent lisibles et que les totaux ne sont pas
                  coupés.
                </p>
                <small>Document de test sans effet sur le stock.</small>
              </div>

              <div className="paper-totals">
                <div>
                  <span>Total HT</span>
                  <strong>{formatTnd(subtotal, locale)}</strong>
                </div>
                <div>
                  <span>TVA {business.defaultTaxPercent}%</span>
                  <strong>{formatTnd(tax, locale)}</strong>
                </div>
                <div className="paper-grand-total">
                  <span>Total TTC test</span>
                  <strong>{formatTnd(total, locale)}</strong>
                </div>
              </div>
            </div>

            <footer className="paper-footer">
              <span>
                {business.companyName.toUpperCase()} · TEST IMPRESSION
              </span>
              <span>DOCUMENT NON COMPTABILISÉ</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
