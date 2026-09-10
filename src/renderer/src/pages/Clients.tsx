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
import { Language, localeFor, t, tr } from '../i18n'
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
          setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible de charger les clients.', 'Unable to load customers.', 'تعذر تحميل الحرفاء.'))
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
          <span className="eyebrow">{tr(lang, 'Répertoire commercial', 'Customer directory', 'دليل الحرفاء')}</span>
          <h1>{t(lang, 'clients')}</h1>
          <p>{tr(lang, 'Enregistrez les coordonnées utiles pour éviter de ressaisir les mêmes informations à chaque facture.', 'Save contact details so you do not have to enter them again on every invoice.', 'احفظ بيانات الاتصال لتجنب إدخالها من جديد في كل فاتورة.')}</p>
        </div>
        <div className="heading-actions">
          <button className="primary-button" type="button" onClick={openCreate}>
            <UserPlus size={18} />
            {tr(lang, 'Nouveau client', 'New customer', 'حريف جديد')}
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
              placeholder={tr(lang, 'Nom, téléphone, matricule fiscal ou adresse…', 'Name, phone, tax ID or address…', 'الاسم أو الهاتف أو المعرّف الجبائي أو العنوان…')}
            />
          </label>
          <span>{tr(lang, `${clients.length} client${clients.length === 1 ? '' : 's'}`, `${clients.length} customer(s)`, `${clients.length} حريف`)}</span>
        </div>

        {loading ? (
          <div className="panel-empty">{tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')}</div>
        ) : clients.length === 0 ? (
          <div className="client-empty-state">
            <div className="client-empty-icon"><Building2 size={24} /></div>
            <strong>{query ? tr(lang, 'Aucun client trouvé', 'No customer found', 'لم يتم العثور على حريف') : tr(lang, 'Aucun client enregistré', 'No customer saved', 'لا يوجد حريف مسجل')}</strong>
            <p>
              {query
                ? tr(lang, 'Essayez une autre recherche.', 'Try another search.', 'جرّب بحثًا آخر.')
                : tr(lang, 'Ajoutez un client pour retrouver rapidement son adresse, téléphone et matricule fiscal.', 'Add a customer to quickly find their address, phone and tax ID.', 'أضف حريفًا للوصول بسرعة إلى عنوانه وهاتفه ومعرّفه الجبائي.')}
            </p>
            {!query && (
              <button className="secondary-button" type="button" onClick={openCreate}>
                <UserPlus size={17} />
                {tr(lang, 'Ajouter le premier client', 'Add the first customer', 'إضافة أول حريف')}
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
                    <small>{client.taxId ? `MF: ${client.taxId}` : tr(lang, 'Sans matricule fiscal', 'No tax ID', 'دون معرّف جبائي')}</small>
                  </div>
                  <div className="client-card-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setHistoryClient(client)}
                      aria-label={`Factures de ${client.name}`}
                      title={tr(lang, 'Historique des factures', 'Invoice history', 'سجل الفواتير')}
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => openEdit(client)}
                      aria-label={`Modifier ${client.name}`}
                      title={tr(lang, 'Modifier le client', 'Edit customer', 'تعديل الحريف')}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>

                <div className="client-details">
                  <div>
                    <Phone size={15} />
                    <span>{client.phone || tr(lang, 'Téléphone non renseigné', 'Phone not entered', 'الهاتف غير مسجل')}</span>
                  </div>
                  <div>
                    <MapPin size={15} />
                    <span>{client.address || tr(lang, 'Adresse non renseignée', 'Address not entered', 'العنوان غير مسجل')}</span>
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
    (sum, invoice) => sum + invoice.netTtcMillimes,
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
              <span className="eyebrow">{tr(lang, 'Historique client', 'Customer history', 'سجل الحريف')}</span>
              <h2>{client.name}</h2>
              <p>
                {tr(lang, 'Factures liées à cette fiche. Les annulations restent visibles et les retours sont déduits du total.', 'Invoices linked to this customer. Cancellations remain visible and returns are deducted from the total.', 'الفواتير المرتبطة بهذا الحريف. تبقى الإلغاءات ظاهرة وتُطرح المرتجعات من المجموع.')}
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
              <span>{tr(lang, 'Factures actives', 'Active invoices', 'الفواتير النشطة')}</span>
              <strong>{activeInvoices.length}</strong>
            </div>
            <div>
              <span>{tr(lang, 'Annulées', 'Cancelled', 'ملغاة')}</span>
              <strong>
                {invoices.length - activeInvoices.length}
              </strong>
            </div>
            <div>
              <span>{tr(lang, 'Total TTC net', 'Net total', 'المجموع الصافي')}</span>
              <strong>{formatTnd(totalBusiness, locale)}</strong>
            </div>
          </div>

          {error && <div className="inline-alert error">{error}</div>}

          {loading ? (
            <div className="panel-empty">{tr(lang, 'Chargement…', 'Loading…', 'جار التحميل…')}</div>
          ) : invoices.length === 0 ? (
            <div className="panel-empty">
              {tr(lang, 'Aucune facture finalisée liée à ce client.', 'No finalized invoice is linked to this customer.', 'لا توجد فاتورة مؤكدة مرتبطة بهذا الحريف.')}
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
                      ? tr(lang, 'Annulée', 'Cancelled', 'ملغاة')
                      : invoice.returnStatus === 'FULL'
                        ? tr(lang, 'Retournée', 'Returned', 'مرتجعة')
                        : invoice.returnStatus === 'PARTIAL'
                          ? tr(lang, 'Retour partiel', 'Partially returned', 'إرجاع جزئي')
                          : tr(lang, 'Finalisée', 'Finalized', 'مؤكدة')}
                  </span>

                  <strong>
                    {formatTnd(invoice.netTtcMillimes, locale)}
                  </strong>

                  <button
                    className="row-preview-button"
                    type="button"
                    onClick={() => void openInvoice(invoice.id)}
                  >
                    <Eye size={15} />
                    {tr(lang, 'Ouvrir', 'Open', 'فتح')}
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
              {tr(lang, 'Fermer', 'Close', 'إغلاق')}
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
  lang,
  onClose,
  onSaved
}: {
  client: Client | null
  lang: Language
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
      setError(tr(lang, 'Le nom du client est obligatoire.', 'Customer name is required.', 'اسم الحريف إجباري.'))
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
      setError(cause instanceof Error ? cause.message : tr(lang, 'Impossible d’enregistrer le client.', 'Unable to save customer.', 'تعذر حفظ الحريف.'))
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
            <span className="eyebrow">{client ? tr(lang, 'Modification', 'Edit', 'تعديل') : tr(lang, 'Nouveau contact', 'New contact', 'جهة اتصال جديدة')}</span>
            <h2>{client ? client.name : tr(lang, 'Ajouter un client', 'Add a customer', 'إضافة حريف')}</h2>
            <p>{tr(lang, 'Les informations pourront ensuite être reprises sur une facture.', 'These details can then be reused on an invoice.', 'يمكن بعد ذلك استعمال هذه البيانات في الفاتورة.')}</p>
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
              placeholder={tr(lang, 'Ex. Garage El Menzah', 'E.g. El Menzah Garage', 'مثال: مرآب المنزه')}
            />
          </label>

          <label className="field">
            <span>{tr(lang, 'Téléphone', 'Phone', 'الهاتف')}</span>
            <input
              value={form.phone}
              onChange={(event) => patch('phone', event.target.value)}
              placeholder="Ex. 22 000 000"
            />
          </label>

          <label className="field">
            <span>{tr(lang, 'Matricule fiscal', 'Tax ID', 'المعرّف الجبائي')}</span>
            <input
              value={form.taxId}
              onChange={(event) => patch('taxId', event.target.value)}
              placeholder={tr(lang, 'Facultatif', 'Optional', 'اختياري')}
            />
          </label>

          <label className="field full">
            <span>{tr(lang, 'Adresse', 'Address', 'العنوان')}</span>
            <input
              value={form.address}
              onChange={(event) => patch('address', event.target.value)}
              placeholder={tr(lang, 'Adresse complète', 'Full address', 'العنوان الكامل')}
            />
          </label>

          <label className="field full">
            <span>{tr(lang, 'Notes', 'Notes', 'ملاحظات')}</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => patch('notes', event.target.value)}
              placeholder={tr(lang, 'Informations utiles, habitudes, conditions commerciales…', 'Useful information, preferences, business terms…', 'معلومات مفيدة، عادات، شروط تجارية…')}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            {tr(lang, 'Annuler', 'Cancel', 'إلغاء')}
          </button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : client ? tr(lang, 'Enregistrer les modifications', 'Save changes', 'حفظ التعديلات') : tr(lang, 'Créer le client', 'Create customer', 'إنشاء الحريف')}
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
