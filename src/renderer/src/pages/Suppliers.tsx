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
import { Language } from '../i18n'

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

export function Suppliers({ lang: _lang }: { lang: Language }): JSX.Element {
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
              : 'Impossible de charger les fournisseurs.'
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
  }, [query])

  async function refresh(): Promise<void> {
    setSuppliers(await window.desktop.suppliers.list(query))
  }

  return (
    <div className="page suppliers-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Approvisionnement</span>
          <h1>Fournisseurs</h1>
          <p>
            Gardez les coordonnées fournisseurs et associez-les aux références du stock.
          </p>
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
            Nouveau fournisseur
          </button>
        </div>
      </section>

      {error && (
        <div className="inline-alert error">
          {error}
          <button type="button" onClick={() => setError('')}>Fermer</button>
        </div>
      )}

      <section className="panel clients-panel">
        <div className="clients-toolbar">
          <label className="table-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, téléphone, email ou adresse…"
            />
          </label>
          <span>
            {suppliers.length} fournisseur{suppliers.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="panel-empty">Chargement…</div>
        ) : suppliers.length === 0 ? (
          <div className="client-empty-state">
            <div className="client-empty-icon"><Truck size={24} /></div>
            <strong>
              {query ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
            </strong>
            <p>
              {query
                ? 'Essayez une autre recherche.'
                : 'Ajoutez les fournisseurs habituels pour les associer aux pièces du catalogue.'}
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
                    <small>{supplier.email || 'Email non renseigné'}</small>
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
                    <span>{supplier.phone || 'Téléphone non renseigné'}</span>
                  </div>
                  <div>
                    <Mail size={15} />
                    <span>{supplier.email || 'Email non renseigné'}</span>
                  </div>
                  <div>
                    <MapPin size={15} />
                    <span>{supplier.address || 'Adresse non renseignée'}</span>
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
  onClose,
  onSaved
}: {
  supplier: Supplier | null
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
      setError('Le nom du fournisseur est obligatoire.')
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
          : 'Impossible d’enregistrer le fournisseur.'
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
              {supplier ? 'Modification' : 'Nouveau fournisseur'}
            </span>
            <h2>{supplier ? supplier.name : 'Ajouter un fournisseur'}</h2>
            <p>Ces informations servent au suivi d’approvisionnement.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="inline-alert error">{error}</div>}

        <div className="form-grid">
          <label className="field full">
            <span>Nom / société *</span>
            <input
              autoFocus
              value={form.name}
              onChange={(event) => patch('name', event.target.value)}
              placeholder="Ex. Fournisseur pièces Renault"
            />
          </label>

          <label className="field">
            <span>Téléphone</span>
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
            <span>Adresse</span>
            <input
              value={form.address}
              onChange={(event) => patch('address', event.target.value)}
            />
          </label>

          <label className="field full">
            <span>Notes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => patch('notes', event.target.value)}
              placeholder="Délais, conditions, références de contact…"
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
            Annuler
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving
              ? 'Enregistrement…'
              : supplier
                ? 'Enregistrer les modifications'
                : 'Créer le fournisseur'}
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
