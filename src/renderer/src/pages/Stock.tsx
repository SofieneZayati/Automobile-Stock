import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react'
import { Archive, ArchiveRestore, Coins, Download, FilterX, History, PackageCheck, PackagePlus, Pencil, PlusCircle, Search, TriangleAlert, X } from 'lucide-react'
import { Language, localeFor, t, tr } from '../i18n'
import { formatTnd } from '../lib/money'
import type { CreatePartInput, Part, StockMovement, Supplier, UpdatePartInput } from '../../../shared/contracts'

export function Stock({
  lang,
  initialQuery = '',
  searchRequestId = 0
}: {
  lang: Language
  initialQuery?: string
  searchRequestId?: number
}): JSX.Element {
  const [query, setQuery] = useState(initialQuery)
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Part | null>(null)
  const [adjusting, setAdjusting] = useState<Part | null>(null)
  const [historyPart, setHistoryPart] = useState<Part | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async (search = query) => {
    try {
      setLoading(true)
      setError('')
      setParts(await window.desktop.parts.list(search, includeArchived))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible de charger le stock.', 'Unable to load stock.', 'تعذر تحميل المخزون.'))
    } finally {
      setLoading(false)
    }
  }, [query, includeArchived, lang])

  useEffect(() => {
    if (searchRequestId > 0) {
      setQuery(initialQuery)
    }
  }, [initialQuery, searchRequestId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(query), 180)
    return () => window.clearTimeout(timeout)
  }, [query, load])

  const suppliers = useMemo(
    () => Array.from(
      new Set(
        parts
          .map((part) => part.supplierName)
          .filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b)),
    [parts]
  )

  const categories = useMemo(
    () => Array.from(
      new Set(
        parts
          .map((part) => part.categoryName)
          .filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b)),
    [parts]
  )

  const visibleParts = useMemo(
    () => parts.filter((part) => {
      if (supplierFilter !== 'all' && part.supplierName !== supplierFilter) {
        return false
      }
      if (categoryFilter !== 'all' && part.categoryName !== categoryFilter) {
        return false
      }

      if (stockFilter === 'out') return part.quantity === 0
      if (stockFilter === 'low') {
        return part.quantity > 0 && part.quantity <= part.lowStockThreshold
      }
      if (stockFilter === 'available') {
        return part.quantity > part.lowStockThreshold
      }
      return true
    }),
    [parts, supplierFilter, categoryFilter, stockFilter]
  )

  const metrics = useMemo(() => {
    const active = parts.filter((part) => part.isActive)
    return {
      references: active.length,
      units: active.reduce((sum, part) => sum + part.quantity, 0),
      low: active.filter(
        (part) =>
          part.quantity > 0
          && part.quantity <= part.lowStockThreshold
      ).length,
      out: active.filter((part) => part.quantity === 0).length,
      purchaseValue: active.reduce(
        (sum, part) =>
          sum + part.purchasePriceMillimes * part.quantity,
        0
      ),
      saleValue: active.reduce(
        (sum, part) =>
          sum + part.salePriceMillimes * part.quantity,
        0
      )
    }
  }, [parts])

  const lowCount = metrics.low + metrics.out

  async function toggleArchive(part: Part): Promise<void> {
    const nextActive = !part.isActive
    if (!nextActive) {
      const stockNote = part.quantity > 0
        ? ' Il reste ' + part.quantity + ' unité(s) enregistrée(s); elles ne seront pas supprimées.'
        : ''
      const confirmed = window.confirm(
        'Archiver ' + part.reference + ' — ' + part.designation + ' ?' +
        stockNote +
        ' La pièce ne sera plus proposée dans les nouvelles factures.'
      )
      if (!confirmed) return
    }

    try {
      setError('')
      await window.desktop.parts.setActive(part.id, nextActive)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de modifier le statut de la pièce.')
    }
  }

  async function exportCsv(): Promise<void> {
    try {
      setExporting(true)
      setError('')
      setNotice('')
      const result = await window.desktop.parts.exportCsv(
        '',
        includeArchived
      )
      if (result) {
        setNotice(
          `Export CSV créé: ${result.rowCount} ligne(s) · ${result.path}`
        )
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’exporter le stock.'
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{tr(lang, `Catalogue du magasin · ${lowCount} alerte(s)`, `Shop catalogue · ${lowCount} alert(s)`, `دليل المحل · ${lowCount} تنبيه`)}</span>
          <h1>{t(lang, 'stock')}</h1>
          <p>{tr(lang, 'Retrouvez rapidement une référence, contrôlez les quantités et ajustez le stock.', 'Quickly find a reference, check quantities and adjust stock.', 'اعثر بسرعة على المرجع وراقب الكميات وعدّل المخزون.')}</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting}
             title={tr(lang, 'Exporter le catalogue complet', 'Export the full catalogue', 'تصدير كامل الدليل')}
          >
            <Download size={18} />
            {exporting ? tr(lang, 'Export…', 'Exporting…', 'جار التصدير…') : tr(lang, 'Exporter la liste', 'Export list', 'تصدير القائمة')}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <PackagePlus size={19} />
            {t(lang, 'addPart')}
          </button>
        </div>
      </section>

      {error && <div className="inline-alert error">{error}<button type="button" onClick={() => void load()}>{tr(lang, 'Réessayer', 'Try again', 'إعادة المحاولة')}</button></div>}
      {notice && (
        <div className="inline-alert success">
          {notice}
          <button type="button" onClick={() => setNotice('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      <section className="stock-metrics" aria-label="Résumé du stock">
        <div className="stock-metric">
          <span className="stock-metric-icon"><PackageCheck size={18} /></span>
          <div>
            <small>{tr(lang, 'Références actives', 'Active references', 'المراجع النشطة')}</small>
            <strong>{metrics.references}</strong>
            <span>{tr(lang, `${metrics.units} unité(s) en stock`, `${metrics.units} unit(s) in stock`, `${metrics.units} وحدة في المخزون`)}</span>
          </div>
        </div>
        <div className="stock-metric">
          <span className="stock-metric-icon warning"><TriangleAlert size={18} /></span>
          <div>
            <small>{tr(lang, 'À surveiller', 'Needs attention', 'تحتاج متابعة')}</small>
            <strong>{metrics.low + metrics.out}</strong>
            <span>{tr(lang, `${metrics.low} faible · ${metrics.out} épuisée(s)`, `${metrics.low} low · ${metrics.out} out`, `${metrics.low} منخفض · ${metrics.out} منتهٍ`)}</span>
          </div>
        </div>
        <div className="stock-metric">
          <span className="stock-metric-icon"><Coins size={18} /></span>
          <div>
            <small>{tr(lang, 'Valeur achat du stock', 'Stock purchase value', 'قيمة شراء المخزون')}</small>
            <strong>{formatTnd(metrics.purchaseValue, localeFor(lang))}</strong>
            <span>{tr(lang, 'Selon les prix d’achat enregistrés', 'Based on saved purchase prices', 'حسب أسعار الشراء المسجلة')}</span>
          </div>
        </div>
        <div className="stock-metric">
          <span className="stock-metric-icon"><Coins size={18} /></span>
          <div>
            <small>{tr(lang, 'Valeur vente théorique', 'Potential sales value', 'قيمة البيع المتوقعة')}</small>
            <strong>{formatTnd(metrics.saleValue, localeFor(lang))}</strong>
            <span>{tr(lang, 'Avant remises commerciales', 'Before discounts', 'قبل الخصومات')}</span>
          </div>
        </div>
      </section>

      <section className="panel stock-panel">
        <div className="stock-toolbar">
          <label className="table-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr(lang, 'Référence, OEM, désignation, véhicule, rayon…', 'Reference, OEM, description, vehicle, shelf…', 'المرجع أو OEM أو البيان أو السيارة أو الرف…')} /></label>
          <select
            className="stock-filter-select"
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(event.target.value as typeof stockFilter)
            }
            aria-label="Filtrer par niveau de stock"
          >
            <option value="all">{tr(lang, 'Tous les stocks', 'All stock levels', 'كل حالات المخزون')}</option>
            <option value="available">{tr(lang, 'Disponible', 'Available', 'متوفر')}</option>
            <option value="low">{t(lang, 'lowStock')}</option>
            <option value="out">{tr(lang, 'Épuisé', 'Out of stock', 'غير متوفر')}</option>
          </select>

          <select
            className="stock-filter-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filtrer par catégorie"
          >
            <option value="all">{tr(lang, 'Toutes catégories', 'All categories', 'كل الأصناف')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            className="stock-filter-select"
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
            aria-label="Filtrer par fournisseur"
          >
            <option value="all">{tr(lang, 'Tous fournisseurs', 'All suppliers', 'كل المزودين')}</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>

          <label className="archive-toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            <span>{tr(lang, 'Archivées', 'Archived', 'مؤرشفة')}</span>
          </label>

          {(stockFilter !== 'all'
            || categoryFilter !== 'all'
            || supplierFilter !== 'all') && (
            <button
              className="icon-button stock-filter-reset"
              type="button"
              title="Réinitialiser les filtres"
              onClick={() => {
                setStockFilter('all')
                setCategoryFilter('all')
                setSupplierFilter('all')
              }}
            >
              <FilterX size={16} />
            </button>
          )}

          <span className="result-count">
            {loading
              ? tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')
              : `${visibleParts.length} / ${parts.length} ${t(lang, 'parts')}`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table stock-table">
            <thead><tr><th>{t(lang, 'ref')}</th><th>{t(lang, 'designation')}</th><th>{tr(lang, 'Compatibilité', 'Compatibility', 'التوافق')}</th><th>{tr(lang, 'Catégorie', 'Category', 'الصنف')}</th><th>{t(lang, 'suppliers')}</th><th>{tr(lang, 'Empl.', 'Location', 'المكان')}</th><th>{tr(lang, 'Stock', 'Stock', 'المخزون')}</th><th>{tr(lang, 'Prix vente', 'Sale price', 'سعر البيع')}</th><th></th></tr></thead>
            <tbody>
              {visibleParts.map((part) => {
                const low = part.quantity <= part.lowStockThreshold
                return (
                  <tr key={part.id} className={part.isActive ? '' : 'archived-row'}>
                    <td><span className="mono-ref">{part.reference}</span>{part.oemReference && <span>{part.oemReference}</span>}</td>
                    <td>
                      <strong>{part.designation}</strong>
                      {!part.isActive && <span className="archived-label">{tr(lang, 'Archivée', 'Archived', 'مؤرشفة')}</span>}
                    </td>
                    <td>{part.vehicleCompatibility || '—'}</td>
                    <td><span className="soft-pill">{part.categoryName || tr(lang, 'Sans catégorie', 'No category', 'دون صنف')}</span></td>
                    <td>{part.supplierName || '—'}</td>
                    <td><span className="location-pill">{part.location || '—'}</span></td>
                    <td>
                      {part.isActive ? (
                        <button
                          className={low ? 'stock-badge low stock-button' : 'stock-badge stock-button'}
                          type="button"
                          onClick={() => setAdjusting(part)}
                        >
                          {part.quantity}
                        </button>
                      ) : (
                        <span className="stock-badge">{part.quantity}</span>
                      )}
                    </td>
                    <td><strong>{formatTnd(part.salePriceMillimes, localeFor(lang))}</strong></td>
                    <td>
                      <div className="stock-row-actions">
                        {part.isActive && (
                          <button
                            className="icon-button table-more"
                            type="button"
                            onClick={() => setAdjusting(part)}
                            title={tr(lang, 'Ajuster le stock', 'Adjust stock', 'تعديل المخزون')}
                          >
                            <PlusCircle size={16} />
                          </button>
                        )}
                        <button
                          className="icon-button table-more"
                          type="button"
                          onClick={() => setHistoryPart(part)}
                          title={tr(lang, 'Historique des mouvements', 'Movement history', 'سجل الحركات')}
                        >
                          <History size={16} />
                        </button>
                        <button
                          className="icon-button table-more"
                          type="button"
                          onClick={() => setEditing(part)}
                          title={tr(lang, 'Modifier la fiche', 'Edit part', 'تعديل القطعة')}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button table-more"
                          type="button"
                          onClick={() => void toggleArchive(part)}
                          title={part.isActive ? tr(lang, 'Archiver', 'Archive', 'أرشفة') : tr(lang, 'Restaurer', 'Restore', 'استعادة')}
                        >
                          {part.isActive ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && visibleParts.length === 0 && (
            <div className="table-empty">
              {tr(lang, 'Aucune pièce ne correspond à la recherche et aux filtres actuels.', 'No part matches the current search and filters.', 'لا توجد قطعة تطابق البحث والمرشحات الحالية.')}
            </div>
          )}
        </div>
      </section>

      {showCreate && <CreatePartModal lang={lang} onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await load() }} />}
      {editing && <EditPartModal part={editing} lang={lang} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load() }} />}
      {historyPart && <MovementHistoryModal part={historyPart} lang={lang} onClose={() => setHistoryPart(null)} />}
      {adjusting && <AdjustStockModal part={adjusting} lang={lang} onClose={() => setAdjusting(null)} onSaved={async () => { setAdjusting(null); await load() }} />}
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
      supplierId: optionalPositiveInteger(data.get('supplierId')),
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
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible d’enregistrer la pièce.', 'Unable to save the part.', 'تعذر حفظ القطعة.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal-card wide" onSubmit={(e) => void submit(e)}>
        <div className="modal-heading">
          <div><span className="eyebrow">{tr(lang, 'Nouvelle référence', 'New reference', 'مرجع جديد')}</span><h2>{t(lang, 'addPart')}</h2><p>{tr(lang, 'Les prix sont saisis en dinars tunisiens.', 'Prices are entered in Tunisian dinars.', 'تُدخل الأسعار بالدينار التونسي.')}</p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="inline-alert error">{error}</div>}
        <div className="form-grid">
          <label className="field"><span>{tr(lang, 'Référence interne *', 'Internal reference *', 'المرجع الداخلي *')}</span><input name="reference" required autoFocus placeholder="BM-REN-052" /></label>
          <label className="field"><span>{tr(lang, 'Désignation *', 'Description *', 'البيان *')}</span><input name="designation" required placeholder={tr(lang, 'Ex. Filtre à air', 'E.g. air filter', 'مثال: مصفاة هواء')} /></label>
          <label className="field"><span>{tr(lang, 'Référence OEM', 'OEM reference', 'مرجع OEM')}</span><input name="oemReference" placeholder="Ex. 165469466R" /></label>
          <label className="field"><span>{tr(lang, 'Compatibilité véhicule', 'Vehicle compatibility', 'توافق السيارة')}</span><input name="vehicleCompatibility" placeholder="Renault Clio IV" /></label>
          <label className="field"><span>{tr(lang, 'Catégorie', 'Category', 'الصنف')}</span><input name="categoryName" placeholder={tr(lang, 'Filtration', 'Filters', 'التصفية')} /></label>
          <SupplierSelect lang={lang} />
          <label className="field"><span>{tr(lang, 'Emplacement', 'Location', 'المكان')}</span><input name="location" placeholder="A-04" /></label>
          <label className="field"><span>{tr(lang, 'Prix achat (DT)', 'Purchase price (TND)', 'سعر الشراء (د.ت)')}</span><input name="purchasePrice" inputMode="decimal" placeholder="0.000" /></label>
          <label className="field"><span>{tr(lang, 'Prix vente (DT) *', 'Sale price (TND) *', 'سعر البيع (د.ت) *')}</span><input name="salePrice" required inputMode="decimal" placeholder="0.000" /></label>
          <label className="field"><span>{tr(lang, 'Stock initial', 'Initial stock', 'المخزون الأولي')}</span><input name="initialQuantity" type="number" min="0" defaultValue="0" /></label>
          <label className="field"><span>{tr(lang, 'Seuil stock faible', 'Low-stock level', 'حد المخزون المنخفض')}</span><input name="lowStockThreshold" type="number" min="0" defaultValue="3" /></label>
          <label className="field full"><span>{tr(lang, 'Notes', 'Notes', 'ملاحظات')}</span><input name="notes" placeholder={tr(lang, 'Information interne facultative', 'Optional internal information', 'معلومة داخلية اختيارية')} /></label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{tr(lang, 'Annuler', 'Cancel', 'إلغاء')}</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : t(lang, 'addPart')}</button>
        </div>
      </form>
    </div>
  )
}


function EditPartModal({ part, lang, onClose, onSaved }: {
  part: Part
  lang: Language
  onClose: () => void
  onSaved: () => Promise<void>
}): JSX.Element {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input: UpdatePartInput = {
      id: part.id,
      reference: String(data.get('reference') || ''),
      designation: String(data.get('designation') || ''),
      oemReference: String(data.get('oemReference') || ''),
      vehicleCompatibility: String(data.get('vehicleCompatibility') || ''),
      categoryName: String(data.get('categoryName') || ''),
      supplierId: optionalPositiveInteger(data.get('supplierId')),
      purchasePriceMillimes: toMillimes(data.get('purchasePrice')),
      salePriceMillimes: toMillimes(data.get('salePrice')),
      lowStockThreshold: toInteger(data.get('lowStockThreshold')),
      location: String(data.get('location') || ''),
      notes: String(data.get('notes') || '')
    }

    try {
      setSaving(true)
      setError('')
      await window.desktop.parts.update(input)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible de modifier la pièce.', 'Unable to edit the part.', 'تعذر تعديل القطعة.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="modal-card wide" onSubmit={(event) => void submit(event)}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{part.reference}</span>
            <h2>{tr(lang, 'Modifier la pièce', 'Edit part', 'تعديل القطعة')}</h2>
            <p>{tr(lang, 'La quantité reste séparée: utilisez « Ajuster le stock » pour garder une trace de chaque mouvement.', 'Quantity is kept separate: use “Adjust stock” to keep a record of every movement.', 'تبقى الكمية منفصلة: استعمل «تعديل المخزون» لحفظ سجل كل حركة.')}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="form-grid">
          <label className="field"><span>{tr(lang, 'Référence interne *', 'Internal reference *', 'المرجع الداخلي *')}</span><input name="reference" required autoFocus defaultValue={part.reference} /></label>
          <label className="field"><span>{tr(lang, 'Désignation *', 'Description *', 'البيان *')}</span><input name="designation" required defaultValue={part.designation} /></label>
          <label className="field"><span>{tr(lang, 'Référence OEM', 'OEM reference', 'مرجع OEM')}</span><input name="oemReference" defaultValue={part.oemReference || ''} /></label>
          <label className="field"><span>{tr(lang, 'Compatibilité véhicule', 'Vehicle compatibility', 'توافق السيارة')}</span><input name="vehicleCompatibility" defaultValue={part.vehicleCompatibility || ''} /></label>
          <label className="field"><span>{tr(lang, 'Catégorie', 'Category', 'الصنف')}</span><input name="categoryName" defaultValue={part.categoryName || ''} /></label>
          <SupplierSelect lang={lang} defaultSupplierId={part.supplierId} />
          <label className="field"><span>{tr(lang, 'Emplacement', 'Location', 'المكان')}</span><input name="location" defaultValue={part.location || ''} /></label>
          <label className="field"><span>{tr(lang, 'Prix achat (DT)', 'Purchase price (TND)', 'سعر الشراء (د.ت)')}</span><input name="purchasePrice" inputMode="decimal" defaultValue={editableTnd(part.purchasePriceMillimes)} /></label>
          <label className="field"><span>{tr(lang, 'Prix vente (DT) *', 'Sale price (TND) *', 'سعر البيع (د.ت) *')}</span><input name="salePrice" required inputMode="decimal" defaultValue={editableTnd(part.salePriceMillimes)} /></label>
          <label className="field"><span>{tr(lang, 'Seuil stock faible', 'Low-stock level', 'حد المخزون المنخفض')}</span><input name="lowStockThreshold" type="number" min="0" defaultValue={part.lowStockThreshold} /></label>
          <div className="stock-edit-lock">
            <span>{tr(lang, 'Stock actuel', 'Current stock', 'المخزون الحالي')}</span>
            <strong>{part.quantity}</strong>
            <small>{tr(lang, 'Non modifiable depuis cette fiche.', 'Use stock adjustment to change it.', 'استعمل تعديل المخزون لتغييره.')}</small>
          </div>
          <label className="field full"><span>{tr(lang, 'Notes', 'Notes', 'ملاحظات')}</span><input name="notes" defaultValue={part.notes || ''} /></label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>{tr(lang, 'Annuler', 'Cancel', 'إلغاء')}</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : tr(lang, 'Enregistrer les modifications', 'Save changes', 'حفظ التعديلات')}</button>
        </div>
      </form>
    </div>
  )
}

function AdjustStockModal({ part, lang, onClose, onSaved }: { part: Part; lang: Language; onClose: () => void; onSaved: () => Promise<void> }): JSX.Element {
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
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible d’ajuster le stock.', 'Unable to adjust stock.', 'تعذر تعديل المخزون.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-heading">
          <div><span className="eyebrow">{part.reference}</span><h2>{tr(lang, 'Ajuster le stock', 'Adjust stock', 'تعديل المخزون')}</h2><p>{part.designation} · {tr(lang, 'Stock actuel', 'Current stock', 'المخزون الحالي')}: <strong>{part.quantity}</strong></p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="inline-alert error">{error}</div>}
        <div className="form-grid single">
          <label className="field"><span>{tr(lang, 'Variation', 'Change', 'التغيير')}</span><input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></label>
          <label className="field"><span>{tr(lang, 'Motif', 'Reason', 'السبب')}</span><select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}><option value="PURCHASE">{tr(lang, 'Entrée fournisseur', 'Supplier delivery', 'دخول من مزود')}</option><option value="CORRECTION">{tr(lang, 'Correction inventaire', 'Inventory correction', 'تصحيح الجرد')}</option><option value="OTHER">{tr(lang, 'Autre', 'Other', 'آخر')}</option></select></label>
          <label className="field"><span>{tr(lang, 'Note', 'Note', 'ملاحظة')}</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr(lang, 'Bon fournisseur, raison de correction…', 'Delivery note, correction reason…', 'وصل المزود أو سبب التصحيح…')} /></label>
          <div className="stock-after">{tr(lang, 'Stock après opération', 'Stock after operation', 'المخزون بعد العملية')}: <strong>{part.quantity + (Number.isFinite(delta) ? delta : 0)}</strong></div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{tr(lang, 'Annuler', 'Cancel', 'إلغاء')}</button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving || !Number.isInteger(delta) || delta === 0 || part.quantity + delta < 0}>{saving ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : tr(lang, 'Enregistrer le mouvement', 'Save movement', 'حفظ الحركة')}</button>
        </div>
      </div>
    </div>
  )
}

function MovementHistoryModal({
  part,
  lang,
  onClose
}: {
  part: Part
  lang: Language
  onClose: () => void
}): JSX.Element {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void window.desktop.parts.movements(part.id)
      .then((result) => {
        if (active) setMovements(result)
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Impossible de charger les mouvements.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [part.id])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card wide movement-history-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{part.reference}</span>
            <h2>{tr(lang, 'Historique du stock', 'Stock history', 'سجل المخزون')}</h2>
            <p>
              {part.designation} · {tr(lang, 'Stock actuel', 'Current stock', 'المخزون الحالي')}: <strong>{part.quantity}</strong>
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        {loading ? (
          <div className="panel-empty">{tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')}</div>
        ) : movements.length === 0 ? (
          <div className="panel-empty">{tr(lang, 'Aucun mouvement enregistré.', 'No stock movement recorded.', 'لا توجد حركة مخزون مسجلة.')}</div>
        ) : (
          <div className="movement-list">
            {movements.map((movement) => (
              <div className="movement-row" key={movement.id}>
                <div className="movement-direction">
                  <span className={movement.quantityDelta > 0 ? 'movement-plus' : 'movement-minus'}>
                    {movement.quantityDelta > 0 ? '+' : ''}
                    {movement.quantityDelta}
                  </span>
                </div>

                <div className="movement-main">
                  <strong>{movementLabel(movement.movementType, lang)}</strong>
                  <span>
                    {movement.quantityBefore} → {movement.quantityAfter}
                    {movement.invoiceNumber ? ` · ${tr(lang, 'Facture', 'Invoice', 'فاتورة')} ${movement.invoiceNumber}` : ''}
                  </span>
                  {movement.note && <small>{movement.note}</small>}
                </div>

                <time>
                  {formatMovementDate(movement.createdAt, localeFor(lang))}
                </time>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            {tr(lang, 'Fermer', 'Close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

function movementLabel(type: StockMovement['movementType'], lang: Language): string {
  switch (type) {
    case 'INITIAL': return tr(lang, 'Stock initial', 'Initial stock', 'المخزون الأولي')
    case 'PURCHASE': return tr(lang, 'Entrée fournisseur', 'Supplier delivery', 'دخول من مزود')
    case 'SALE': return tr(lang, 'Vente', 'Sale', 'بيع')
    case 'CORRECTION': return tr(lang, 'Correction inventaire', 'Inventory correction', 'تصحيح الجرد')
    case 'RETURN': return tr(lang, 'Retour client', 'Customer return', 'إرجاع حريف')
    case 'CANCELLATION': return tr(lang, 'Annulation', 'Cancellation', 'إلغاء')
    default: return tr(lang, 'Autre mouvement', 'Other movement', 'حركة أخرى')
  }
}

function formatMovementDate(value: string, locale: string): string {
  const parsed = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(locale)
}

function SupplierSelect({
  lang,
  defaultSupplierId
}: {
  lang: Language
  defaultSupplierId?: number | null
}): JSX.Element {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void window.desktop.suppliers.list()
      .then((result) => {
        if (active) setSuppliers(result)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <label className="field">
      <span>{t(lang, 'suppliers')}</span>
      <select name="supplierId" defaultValue={defaultSupplierId ?? ''}>
        <option value="">
          {loading ? tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…') : tr(lang, 'Aucun fournisseur', 'No supplier', 'دون مزود')}
        </option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
    </label>
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

function optionalPositiveInteger(
  value: FormDataEntryValue | null
): number | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function editableTnd(millimes: number): string {
  return (millimes / 1000).toFixed(3)
}
