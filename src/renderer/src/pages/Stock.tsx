import { useMemo, useState, type JSX } from 'react'
import { Filter, MoreHorizontal, PackagePlus, Search, SlidersHorizontal } from 'lucide-react'
import { parts } from '../data/mock'
import { Language, localeFor, t } from '../i18n'
import { formatTnd } from '../lib/money'

export function Stock({ lang }: { lang: Language }): JSX.Element {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return parts
    return parts.filter((part) =>
      [part.ref, part.designation, part.vehicle, part.category, part.location]
        .some((value) => value.toLocaleLowerCase().includes(needle))
    )
  }, [query])

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>{t(lang, 'stock')}</h1>
          <p>Retrouvez rapidement une référence, contrôlez les quantités et ajustez le stock.</p>
        </div>
        <button className="primary-button" type="button"><PackagePlus size={19} />{t(lang, 'addPart')}</button>
      </section>

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Référence, désignation, véhicule, rayon…" /></label>
          <button className="secondary-button" type="button"><Filter size={17} />Catégorie</button>
          <button className="secondary-button" type="button"><SlidersHorizontal size={17} />Filtres</button>
          <span className="result-count">{visible.length} {t(lang, 'parts')}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table stock-table">
            <thead><tr><th>Référence</th><th>Désignation</th><th>Compatibilité</th><th>Catégorie</th><th>Empl.</th><th>Stock</th><th>Prix vente</th><th></th></tr></thead>
            <tbody>
              {visible.map((part) => {
                const low = part.qty <= part.threshold
                return (
                  <tr key={part.id}>
                    <td><span className="mono-ref">{part.ref}</span></td>
                    <td><strong>{part.designation}</strong></td>
                    <td>{part.vehicle}</td>
                    <td><span className="soft-pill">{part.category}</span></td>
                    <td><span className="location-pill">{part.location}</span></td>
                    <td><span className={low ? 'stock-badge low' : 'stock-badge'}>{part.qty}</span></td>
                    <td><strong>{formatTnd(part.priceMillimes, localeFor(lang))}</strong></td>
                    <td><button className="icon-button table-more" type="button"><MoreHorizontal size={18} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
