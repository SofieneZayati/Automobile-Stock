import { useEffect, useState, type JSX } from 'react'
import {
  Building2,
  MapPin,
  Eye,
  FileText,
  Pencil,
  Phone,
  Search,
  UserPlus,
  X
} from 'lucide-react'
import type {
  Client,
  CreateClientInput,
  FinalizedInvoice,
  InvoiceListItem,
  UpdateClientInput
} from '../../../shared/contracts'
import { Language, localeFor } from '../i18n'
import { formatTnd } from '../lib/money'
import { FinalizedInvoicePreview } from '../components/FinalizedInvoicePreview'

type ClientFormState = {
  name: string
  phone: string
  address: string
  taxId: string
  notes: string
}

const emptyForm: ClientFormState = {
  name: '',
  phone: '',
  address: '',
  taxId: '',
  notes: ''
}

export function Clients({ lang }: { lang: Language }): JSX.Element {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Client | null>(null)
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const result = await window.desktop.clients.list(query)
        if (active) setClients(result)
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Impossible de charger les clients.')
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

  function openCreate(): void {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(client: Client): void {
    setEditing(client)
    setShowForm(true)
  }

  async function refresh(): Promise<void> {
    const result = await window.desktop.clients.list(query)
    setClients(result)
  }

  return (
    <div className="page clients-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Répertoire commercial</span>
          <h1>Clients</h1>
          <p>
            Enregistrez les coordonnées utiles pour éviter de ressaisir les mêmes informations à chaque facture.
          </p>
        </div>
        <div className="heading-actions">
          <button className="primary-button" type="button" onClick={openCreate}>
            <UserPlus size={18} />
            Nouveau client
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
              placeholder="Nom, téléphone, matricule fiscal ou adresse…"
            />
          </label>
          <span>{clients.length} client{clients.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="panel-empty">Chargement…</div>
        ) : clients.length === 0 ? (
          <div className="client-empty-state">
            <div className="client-empty-icon"><Building2 size={24} /></div>
            <strong>{query ? 'Aucun client trouvé' : 'Aucun client enregistré'}</strong>
            <p>
              {query
                ? 'Essayez une autre recherche.'
                : 'Ajoutez un client pour retrouver rapidement son adresse, téléphone et matricule fiscal.'}
            </p>
            {!query && (
              <button className="secondary-button" type="button" onClick={openCreate}>
                <UserPlus size={17} />
                Ajouter le premier client
              </button>
            )}
          </div>
        ) : (
          <div className="client-card-grid">
            {clients.map((client) => (
              <article className="client-card" key={client.id}>
                <div className="client-card-head">
                  <div className="client-avatar">
                    {initials(client.name)}
                  </div>
                  <div>
                    <strong>{client.name}</strong>
                    <small>{client.taxId ? `MF: ${client.taxId}` : 'Sans matricule fiscal'}</small>
                  </div>
                  <div className="client-card-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setHistoryClient(client)}
                      aria-label={`Factures de ${client.name}`}
                      title="Historique des factures"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => openEdit(client)}
                      aria-label={`Modifier ${client.name}`}
                      title="Modifier le client"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>

                <div className="client-details">
                  <div>
                    <Phone size={15} />
                    <span>{client.phone || 'Téléphone non renseigné'}</span>
                  </div>
                  <div>
                    <MapPin size={15} />
                    <span>{client.address || 'Adresse non renseignée'}</span>
                  </div>
                </div>

                {client.notes && (
                  <p className="client-notes">{client.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {historyClient && (
        <ClientInvoiceHistory
          client={historyClient}
          lang={lang}
          onClose={() => setHistoryClient(null)}
        />
      )}

      {showForm && (
        <ClientModal
          client={editing}
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

function ClientInvoiceHistory({
  client,
  lang,
  onClose
}: {
  client: Client
  lang: Language
  onClose: () => void
}): JSX.Element {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selected, setSelected] = useState<FinalizedInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const locale = localeFor(lang)

  useEffect(() => {
    let active = true

    void window.desktop.invoices.listByClient(client.id)
      .then((result) => {
        if (active) setInvoices(result)
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Impossible de charger les factures du client.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [client.id])

  async function openInvoice(id: number): Promise<void> {
    try {
      setError('')
      const invoice = await window.desktop.invoices.get(id)
      if (!invoice) throw new Error('Facture introuvable.')
      setSelected(invoice)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’ouvrir la facture.'
      )
    }
  }

  const activeInvoices = invoices.filter(
    (invoice) => invoice.status === 'FINALIZED'
  )
  const totalBusiness = activeInvoices.reduce(
    (sum, invoice) => sum + invoice.totalTtcMillimes,
    0
  )

  return (
    <>
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div className="modal-card wide client-history-modal">
          <div className="modal-heading">
            <div>
              <span className="eyebrow">Historique client</span>
              <h2>{client.name}</h2>
              <p>
                Factures liées à cette fiche client. Les ventes annulées
                restent visibles mais ne sont pas comptées dans le chiffre.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          <div className="client-history-summary">
            <div>
              <span>Factures actives</span>
              <strong>{activeInvoices.length}</strong>
            </div>
            <div>
              <span>Annulées</span>
              <strong>
                {invoices.length - activeInvoices.length}
              </strong>
            </div>
            <div>
              <span>Total TTC historique</span>
              <strong>{formatTnd(totalBusiness, locale)}</strong>
            </div>
          </div>

          {error && <div className="inline-alert error">{error}</div>}

          {loading ? (
            <div className="panel-empty">Chargement…</div>
          ) : invoices.length === 0 ? (
            <div className="panel-empty">
              Aucune facture finalisée liée à ce client.
            </div>
          ) : (
            <div className="client-history-list">
              {invoices.map((invoice) => (
                <div
                  className={
                    invoice.status === 'CANCELLED'
                      ? 'client-history-row cancelled'
                      : 'client-history-row'
                  }
                  key={invoice.id}
                >
                  <div>
                    <strong>{invoice.number}</strong>
                    <span>
                      {formatClientInvoiceDate(
                        invoice.finalizedAt,
                        locale
                      )}
                    </span>
                  </div>

                  <span
                    className={
                      invoice.status === 'CANCELLED'
                        ? 'invoice-status cancelled'
                        : 'invoice-status finalized'
                    }
                  >
                    {invoice.status === 'CANCELLED'
                      ? 'Annulée'
                      : 'Finalisée'}
                  </span>

                  <strong>
                    {formatTnd(invoice.totalTtcMillimes, locale)}
                  </strong>

                  <button
                    className="row-preview-button"
                    type="button"
                    onClick={() => void openInvoice(invoice.id)}
                  >
                    <Eye size={15} />
                    Ouvrir
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <FinalizedInvoicePreview
          invoice={selected}
          lang={lang}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

function formatClientInvoiceDate(
  value: string,
  locale: string
): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      })
}

function ClientModal({
  client,
  onClose,
  onSaved
}: {
  client: Client | null
  onClose: () => void
  onSaved: () => Promise<void>
}): JSX.Element {
  const [form, setForm] = useState<ClientFormState>(() => client
    ? {
        name: client.name,
        phone: client.phone ?? '',
        address: client.address ?? '',
        taxId: client.taxId ?? '',
        notes: client.notes ?? ''
      }
    : emptyForm
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function patch<K extends keyof ClientFormState>(
    key: K,
    value: ClientFormState[K]
  ): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(): Promise<void> {
    if (!form.name.trim()) {
      setError('Le nom du client est obligatoire.')
      return
    }

    try {
      setSaving(true)
      setError('')

      if (client) {
        const input: UpdateClientInput = {
          id: client.id,
          ...form
        }
        await window.desktop.clients.update(input)
      } else {
        const input: CreateClientInput = { ...form }
        await window.desktop.clients.create(input)
      }

      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le client.')
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
            <span className="eyebrow">{client ? 'Modification' : 'Nouveau contact'}</span>
            <h2>{client ? client.name : 'Ajouter un client'}</h2>
            <p>Les informations pourront ensuite être reprises sur une facture.</p>
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
              placeholder="Ex. Garage El Menzah"
            />
          </label>

          <label className="field">
            <span>Téléphone</span>
            <input
              value={form.phone}
              onChange={(event) => patch('phone', event.target.value)}
              placeholder="Ex. 22 000 000"
            />
          </label>

          <label className="field">
            <span>Matricule fiscal</span>
            <input
              value={form.taxId}
              onChange={(event) => patch('taxId', event.target.value)}
              placeholder="Facultatif"
            />
          </label>

          <label className="field full">
            <span>Adresse</span>
            <input
              value={form.address}
              onChange={(event) => patch('address', event.target.value)}
              placeholder="Adresse complète"
            />
          </label>

          <label className="field full">
            <span>Notes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => patch('notes', event.target.value)}
              placeholder="Informations utiles, habitudes, conditions commerciales…"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Enregistrement…' : client ? 'Enregistrer les modifications' : 'Créer le client'}
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
    .slice(0, 2) || 'CL'
}
