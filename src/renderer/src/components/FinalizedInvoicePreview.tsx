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
  const cancelledAt = invoice.cancelledAt
    ? new Date(
        invoice.cancelledAt.replace(' ', 'T') + 'Z'
      ).toLocaleString(locale)
    : null

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
            <span className="eyebrow">
              {invoice.status === 'CANCELLED'
                ? 'Document annulé'
                : 'Document final'}
            </span>
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
          <article
            className={
              invoice.status === 'CANCELLED'
                ? 'invoice-paper cancelled-paper'
                : 'invoice-paper'
            }
          >
            <header className="paper-header">
              <div className="paper-brand">
                <div className="paper-mark">BM</div>
                <div>
                  <strong>{invoice.business.companyName.toUpperCase()}</strong>
                  <span>{invoice.business.activity.toUpperCase()}</span>
                  <small>
                    {[invoice.business.companyNameAr, invoice.business.activityAr]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
              </div>
              <div className="paper-title">
                <span>FACTURE</span>
                <strong>{invoice.number}</strong>
                <small>{finalizedAt}</small>
              </div>
            </header>

            {invoice.status === 'CANCELLED' && (
              <div className="paper-cancelled-banner">
                <strong>FACTURE ANNULÉE</strong>
                <span>
                  {cancelledAt ? `Annulée le ${cancelledAt}` : 'Facture annulée'}
                  {invoice.cancellationReason
                    ? ` · Motif: ${invoice.cancellationReason}`
                    : ''}
                </span>
              </div>
            )}

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
                <strong>{invoice.business.address}</strong>
                <small>
                  {[invoice.business.phone1, invoice.business.phone2]
                    .filter(Boolean)
                    .join(' / ')}
                  {invoice.business.taxId ? ` · MF ${invoice.business.taxId}` : ''}
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
                <small>
                  {invoice.status === 'CANCELLED'
                    ? 'Document annulé: les valeurs d’origine restent figées pour l’historique.'
                    : 'Document final: les prix et remises sont figés.'}
                </small>
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
                  <span>TVA {invoice.business.defaultTaxPercent}%</span>
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
                  <span>
                    {invoice.status === 'CANCELLED'
                      ? 'Total TTC d’origine'
                      : 'Total TTC à payer'}
                  </span>
                  <strong>{formatTnd(invoice.totalTtcMillimes, locale)}</strong>
                </div>
              </div>
            </div>

            <footer className="paper-footer">
              <span>
                {invoice.business.companyName.toUpperCase()} · {invoice.business.activity.toUpperCase()}
              </span>
              <span>
                {invoice.business.address} · {[invoice.business.phone1, invoice.business.phone2]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
