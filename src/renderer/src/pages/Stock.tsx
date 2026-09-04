import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react'
import { Filter, MoreHorizontal, PackagePlus, PlusCircle, Search, SlidersHorizontal, X } from 'lucide-react'
import { Language, localeFor, t } from '../i18n'
import { formatTnd } from '../lib/money'
import type { CreatePartInput, Part } from '../../../shared/contracts'

export function Stock({ lang }: { lang: Language }): JSX.Element {
  const [query, setQuery] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [adjusting, setAdjusting] = useState<Part | null>(null)

  const load = useCallback(async (search = query) => {
    try {
      setLoading(true)
      setError('')
      setParts(await window.desktop.parts.list(search))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger le stock.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(query), 180)
    return () => window.clearTimeout(timeout)
  }, [query, load])

  const lowCount = useMemo(() => parts.filter((part) => part.quantity <= part.lowStockThreshold).length, [parts])

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Catalogue local · {lowCount} alerte(s)</span>
          <h1>{t(lang, 'stock')}</h1>
          <p>Retrouvez rapidement une référence, contrôlez les quantités et ajustez le stock.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowCreate(true)}><PackagePlus size={19} />{t(lang, 'addPart')}</button>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => void load()}>Réessayer</button></div>}

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Référence, OEM, désignation, véhicule, rayon…" /></label>
          <button className="secondary-button" type="button"><Filter size={17} />Catégorie</button>
          <button className="secondary-button" type="button"><SlidersHorizontal size={17} />Filtres</button>
          <span className="result-count">{loading ? 'Chargement…' : `${parts.length} ${t(lang, 'parts')}`}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table stock-table">
            <thead><tr><th>Référence</th><th>Désignation</th><th>Compatibilité</th><th>Catégorie</th><th>Empl.</th><th>Stock</th><th>Prix vente</th><th></th></tr></thead>
            <tbody>
              {parts.map((part) => {
                const low = part.quantity <= part.lowStockThreshold
                return (
                  <tr key={part.id}>
                    <td><span className="mono-ref">{part.reference}</span>{part.oemReference && <span>{part.oemReference}</span>}</td>
                    <td><strong>{part.designation}</strong></td>
                    <td>{part.vehicleCompatibility || '—'}</td>
                    <td><span className="soft-pill">{part.categoryName || 'Sans catégorie'}</span></td>
                    <td><span className="location-pill">{part.location || '—'}</span></td>
                    <td><button className={low ? 'stock-badge low stock-button' : 'stock-badge stock-button'} type="button" onClick={() => setAdjusting(part)}>{part.quantity}</button></td>
                    <td><strong>{formatTnd(part.salePriceMillimes, localeFor(lang))}</strong></td>
                    <td>
                      <button className="icon-button table-more" type="button" onClick={() => setAdjusting(part)} title="Ajuster le stock">
                        <PlusCircle size={17} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && parts.length === 0 && <div className="table-empty">Aucune pièce trouvée. Ajoutez la première référence ou modifiez votre recherche.</div>}
        </div>
      </section>

      {showCreate && <CreatePartModal lang={lang} onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await load() }} />}
      {adjusting && <AdjustStockModal part={adjusting} onClose={() => setAdjusting(null)} onSaved={async () => { setAdjusting(null); await load() }} />}
    </div>
  )
}

function CreatePartModal({ lang, onClose, onCreated }: { lang: Language; onClose: () => void; onCreated: () => Promise<void> }): JSX.Element {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input: CreatePartInput = {
      reference: String(data.get('reference') || ''),
      designation: String(data.get('designation') || ''),
      oemReference: String(data.get('oemReference') || ''),
      vehicleCompatibility: String(data.get('vehicleCompatibility') || ''),
      categoryName: String(data.get('categoryName') || ''),
      purchasePriceMillimes: toMillimes(data.get('purchasePrice')),
      salePriceMillimes: toMillimes(data.get('salePrice')),
      initialQuantity: toInteger(data.get('initialQuantity')),
      lowStockThreshold: toInteger(data.get('lowStockThreshold')),
      location: String(data.get('location') || ''),
      notes: String(data.get('notes') || '')
    }

    try {
      setSaving(true)
      setError('')
      await window.desktop.parts.create(input)
      await onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la pièce.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal-card wide" onSubmit={(e) => void submit(e)}>
        <div className="modal-heading">
          <div><span className="eyebrow">Nouvelle référence</span><h2>Ajouter une pièce</h2><p>Les prix sont saisis en dinars tunisiens.</p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="inline-alert error">{error}</div>}
        <div className="form-grid">
          <label className="field"><span>Référence interne *</span><input name="reference" required autoFocus placeholder="BM-REN-052" /></label>
          <label className="field"><span>Désignation *</span><input name="designation" required placeholder="Ex. Filtre à air" /></label>
          <label className="field"><span>Référence OEM</span><input name="oemReference" placeholder="Ex. 165469466R" /></label>
          <label className="field"><span>Compatibilité véhicule</span><input name="vehicleCompatibility" placeholder="Renault Clio IV" /></label>
          <label className="field"><span>Catégorie</span><input name="categoryName" placeholder="Filtration" /></label>
          <label className="field"><span>Emplacement</span><input name="location" placeholder="A-04" /></label>
          <label className="field"><span>Prix achat (DT)</span><input name="purchasePrice" inputMode="decimal" placeholder="0.000" /></label>
          <label className="field"><span>Prix vente (DT) *</span><input name="salePrice" required inputMode="decimal" placeholder="0.000" /></label>
          <label className="field"><span>Stock initial</span><input name="initialQuantity" type="number" min="0" defaultValue="0" /></label>
          <label className="field"><span>Seuil stock faible</span><input name="lowStockThreshold" type="number" min="0" defaultValue="3" /></label>
          <label className="field full"><span>Notes</span><input name="notes" placeholder="Information interne facultative" /></label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : t(lang, 'addPart')}</button>
        </div>
      </form>
    </div>
  )
}

function AdjustStockModal({ part, onClose, onSaved }: { part: Part; onClose: () => void; onSaved: () => Promise<void> }): JSX.Element {
  const [delta, setDelta] = useState(1)
  const [reason, setReason] = useState<'PURCHASE' | 'CORRECTION' | 'RETURN' | 'OTHER'>('PURCHASE')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(): Promise<void> {
    try {
      setSaving(true)
      setError('')
      await window.desktop.parts.adjustStock({ partId: part.id, delta, reason, note })
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ajuster le stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-heading">
          <div><span className="eyebrow">{part.reference}</span><h2>Ajuster le stock</h2><p>{part.designation} · Stock actuel: <strong>{part.quantity}</strong></p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="inline-alert error">{error}</div>}
        <div className="form-grid single">
          <label className="field"><span>Variation</span><input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></label>
          <label className="field"><span>Motif</span><select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}><option value="PURCHASE">Entrée fournisseur</option><option value="RETURN">Retour</option><option value="CORRECTION">Correction inventaire</option><option value="OTHER">Autre</option></select></label>
          <label className="field"><span>Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bon fournisseur, raison de correction…" /></label>
          <div className="stock-after">Stock après opération: <strong>{part.quantity + (Number.isFinite(delta) ? delta : 0)}</strong></div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving || !Number.isInteger(delta) || delta === 0 || part.quantity + delta < 0}>{saving ? 'Enregistrement…' : 'Enregistrer le mouvement'}</button>
        </div>
      </div>
    </div>
  )
}

function toMillimes(value: FormDataEntryValue | null): number {
  const raw = String(value || '').trim().replace(',', '.')
  if (!raw) return 0
  const amount = Number(raw)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 1000) : -1
}

function toInteger(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value || '0'))
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1
}
