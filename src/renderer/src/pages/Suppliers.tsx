import { useEffect, useState, type JSX } from 'react'
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Truck,
  UserPlus,
  X
} from 'lucide-react'
import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput
} from '../../../shared/contracts'
import { Language, t, tr } from '../i18n'

type SupplierFormState = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const emptyForm: SupplierFormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
}

export function Suppliers({ lang }: { lang: Language }): JSX.Element {
  const [query, setQuery] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const result = await window.desktop.suppliers.list(query)
        if (active) setSuppliers(result)
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : tr(lang, 'Impossible de charger les fournisseurs.', 'Unable to load suppliers.', 'تعذر تحميل المزودين.')
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 140)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, lang])

  async function refresh(): Promise<void> {
    setSuppliers(await window.desktop.suppliers.list(query))
  }

  return (
    <div className="page suppliers-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{tr(lang, 'Approvisionnement', 'Supply', 'التزويد')}</span>
          <h1>{t(lang, 'suppliers')}</h1>
          <p>{tr(lang, 'Gardez les coordonnées fournisseurs et associez-les aux références du stock.', 'Keep supplier details and link them to stock references.', 'احفظ بيانات المزودين واربطها بمراجع المخزون.')}</p>
        </div>

        <div className="heading-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <UserPlus size={18} />
            {tr(lang, 'Nouveau fournisseur', 'New supplier', 'مزود جديد')}
          </button>
        </div>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      <section className="panel clients-panel">
        <div className="clients-toolbar">
          <label className="table-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr(lang, 'Nom, téléphone, email ou adresse…', 'Name, phone, email or address…', 'الاسم أو الهاتف أو البريد أو العنوان…')}
            />
          </label>
          <span>
            {tr(lang, `${suppliers.length} fournisseur${suppliers.length === 1 ? '' : 's'}`, `${suppliers.length} supplier(s)`, `${suppliers.length} مزود`)}
          </span>
        </div>

        {loading ? (
          <div className="panel-empty">{tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')}</div>
        ) : suppliers.length === 0 ? (
          <div className="client-empty-state">
            <div className="client-empty-icon"><Truck size={24} /></div>
            <strong>
              {query ? tr(lang, 'Aucun fournisseur trouvé', 'No supplier found', 'لم يتم العثور على مزود') : tr(lang, 'Aucun fournisseur enregistré', 'No supplier saved', 'لا يوجد مزود مسجل')}
            </strong>
            <p>
              {query
                ? tr(lang, 'Essayez une autre recherche.', 'Try another search.', 'جرّب بحثًا آخر.')
                : tr(lang, 'Ajoutez les fournisseurs habituels pour les associer aux pièces du catalogue.', 'Add regular suppliers to link them to catalogue parts.', 'أضف المزودين المعتادين لربطهم بقطع الدليل.')}
            </p>
          </div>
        ) : (
          <div className="client-card-grid">
            {suppliers.map((supplier) => (
              <article className="client-card" key={supplier.id}>
                <div className="client-card-head">
                  <div className="client-avatar">
                    {initials(supplier.name)}
                  </div>
                  <div>
                    <strong>{supplier.name}</strong>
                    <small>{supplier.email || tr(lang, 'Email non renseigné', 'Email not entered', 'البريد غير مسجل')}</small>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => {
                      setEditing(supplier)
                      setShowForm(true)
                    }}
                    aria-label={`Modifier ${supplier.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                </div>

                <div className="client-details">
                  <div>
                    <Phone size={15} />
                    <span>{supplier.phone || tr(lang, 'Téléphone non renseigné', 'Phone not entered', 'الهاتف غير مسجل')}</span>
                  </div>
                  <div>
                    <Mail size={15} />
                    <span>{supplier.email || tr(lang, 'Email non renseigné', 'Email not entered', 'البريد غير مسجل')}</span>
                  </div>
                  <div>
                    <MapPin size={15} />
                    <span>{supplier.address || tr(lang, 'Adresse non renseignée', 'Address not entered', 'العنوان غير مسجل')}</span>
                  </div>
                </div>

                {supplier.notes && (
                  <p className="client-notes">{supplier.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <SupplierModal
          supplier={editing}
          lang={lang}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function SupplierModal({
  supplier,
  lang,
  onClose,
  onSaved
}: {
  supplier: Supplier | null
  lang: Language
  onClose: () => void
  onSaved: () => Promise<void>
}): JSX.Element {
  const [form, setForm] = useState<SupplierFormState>(() => supplier
    ? {
        name: supplier.name,
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        notes: supplier.notes ?? ''
      }
    : emptyForm
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function patch<K extends keyof SupplierFormState>(
    key: K,
    value: SupplierFormState[K]
  ): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(): Promise<void> {
    if (!form.name.trim()) {
      setError(tr(lang, 'Le nom du fournisseur est obligatoire.', 'Supplier name is required.', 'اسم المزود إجباري.'))
      return
    }

    try {
      setSaving(true)
      setError('')

      if (supplier) {
        const input: UpdateSupplierInput = {
          id: supplier.id,
          ...form
        }
        await window.desktop.suppliers.update(input)
      } else {
        const input: CreateSupplierInput = { ...form }
        await window.desktop.suppliers.create(input)
      }

      await onSaved()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr(lang, 'Impossible d’enregistrer le fournisseur.', 'Unable to save supplier.', 'تعذر حفظ المزود.')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card wide">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {supplier ? tr(lang, 'Modification', 'Edit', 'تعديل') : tr(lang, 'Nouveau fournisseur', 'New supplier', 'مزود جديد')}
            </span>
            <h2>{supplier ? supplier.name : tr(lang, 'Ajouter un fournisseur', 'Add a supplier', 'إضافة مزود')}</h2>
            <p>{tr(lang, 'Ces informations servent au suivi d’approvisionnement.', 'These details help track supplies.', 'تساعد هذه البيانات في متابعة التزويد.')}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="form-grid">
          <label className="field full">
            <span>{tr(lang, 'Nom / société *', 'Name / company *', 'الاسم / الشركة *')}</span>
            <input
              autoFocus
              value={form.name}
              onChange={(event) => patch('name', event.target.value)}
              placeholder={tr(lang, 'Ex. Fournisseur pièces Renault', 'E.g. Renault parts supplier', 'مثال: مزود قطع رينو')}
            />
          </label>

          <label className="field">
            <span>{tr(lang, 'Téléphone', 'Phone', 'الهاتف')}</span>
            <input
              value={form.phone}
              onChange={(event) => patch('phone', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => patch('email', event.target.value)}
            />
          </label>

          <label className="field full">
            <span>{tr(lang, 'Adresse', 'Address', 'العنوان')}</span>
            <input
              value={form.address}
              onChange={(event) => patch('address', event.target.value)}
            />
          </label>

          <label className="field full">
            <span>{tr(lang, 'Notes', 'Notes', 'ملاحظات')}</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => patch('notes', event.target.value)}
              placeholder={tr(lang, 'Délais, conditions, références de contact…', 'Lead times, terms, contact details…', 'الآجال والشروط وبيانات الاتصال…')}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            {tr(lang, 'Annuler', 'Cancel', 'إلغاء')}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving
              ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…')
              : supplier
                ? tr(lang, 'Enregistrer les modifications', 'Save changes', 'حفظ التعديلات')
                : tr(lang, 'Créer le fournisseur', 'Create supplier', 'إنشاء المزود')}
          </button>
        </div>
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'FR'
}
