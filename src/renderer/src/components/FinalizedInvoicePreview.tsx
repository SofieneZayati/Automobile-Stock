import type { JSX } from 'react'
import { Printer, X } from 'lucide-react'
import type { FinalizedInvoice } from '../../../shared/contracts'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'

export function FinalizedInvoicePreview({ invoice, lang, onClose }: {
  invoice: FinalizedInvoice
  lang: Language
  onClose: () => void
}): JSX.Element {
  const locale = localeFor(lang)
  const finalizedAt = new Date(
    invoice.finalizedAt.replace(' ', 'T') + 'Z'
  ).toLocaleString(locale)
  const netHt = invoice.subtotalHtMillimes - invoice.discountMillimes

  return (
    <div
      className="modal-backdrop invoice-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="invoice-preview-modal">
        <div className="invoice-preview-actions">
          <div>
            <span className="eyebrow">Document final</span>
            <strong>{invoice.number}</strong>
          </div>
          <div>
            <button className="secondary-button" type="button" onClick={() => window.print()}>
              <Printer size={17} />Imprimer
            </button>
            <button className="icon-button" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="history-paper-shell">
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
                <strong>{invoice.number}</strong>
                <small>{finalizedAt}</small>
              </div>
            </header>

            <div className="paper-meta">
              <div>
                <span className="paper-label">CLIENT</span>
                <strong>{invoice.customerName}</strong>
                {invoice.customerAddress && <small>{invoice.customerAddress}</small>}
                {invoice.customerTaxId && (
                  <small>Identifiant fiscal: {invoice.customerTaxId}</small>
                )}
              </div>
              <div>
                <span className="paper-label">ÉTABLISSEMENT</span>
                <strong>31, Rue Chedly Kallala · 1002 Tunis</strong>
                <small>Tél. 71 801 813 / 29 276 853</small>
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
                {invoice.lines.map((line, index) => {
                  const unitDiscount =
                    line.unitPriceHtMillimes - line.netUnitPriceHtMillimes

                  return (
                    <tr key={`${line.reference}-${index}`}>
                      <td>{line.reference}</td>
                      <td>{line.designation}</td>
                      <td className="number">{line.quantity}</td>
                      <td className="number">
                        {formatTnd(line.netUnitPriceHtMillimes, locale)}
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
                <p>{invoice.notes || 'Merci pour votre confiance.'}</p>
                <small>Document final: les prix et remises sont figés.</small>
              </div>

              <div className="paper-totals">
                <div>
                  <span>Total HT catalogue</span>
                  <strong>{formatTnd(invoice.subtotalHtMillimes, locale)}</strong>
                </div>

                {invoice.discountMillimes > 0 && (
                  <div className="paper-discount">
                    <span>Remises articles</span>
                    <strong>- {formatTnd(invoice.discountMillimes, locale)}</strong>
                  </div>
                )}

                <div>
                  <span>Total HT net</span>
                  <strong>{formatTnd(netHt, locale)}</strong>
                </div>
                <div>
                  <span>TVA</span>
                  <strong>{formatTnd(invoice.taxMillimes, locale)}</strong>
                </div>

                {invoice.globalDiscountTtcMillimes > 0 && (
                  <>
                    <div>
                      <span>Sous-total TTC</span>
                      <strong>
                        {formatTnd(
                          invoice.totalBeforeGlobalDiscountTtcMillimes,
                          locale
                        )}
                      </strong>
                    </div>
                    <div className="paper-discount">
                      <span>Remise globale</span>
                      <strong>
                        - {formatTnd(invoice.globalDiscountTtcMillimes, locale)}
                      </strong>
                    </div>
                  </>
                )}

                <div className="paper-grand-total">
                  <span>Total TTC à payer</span>
                  <strong>{formatTnd(invoice.totalTtcMillimes, locale)}</strong>
                </div>
              </div>
            </div>

            <footer className="paper-footer">
              <span>ETABLISSEMENT BEN MAHMOUD · ÉQUIPEMENT AUTOMOBILES</span>
              <span>31, Rue Chedly Kallala, 1002 Tunis · 71 801 813 · 29 276 853</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
