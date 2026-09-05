import { useEffect, useMemo, useState, type JSX } from 'react'
import {
  CheckCircle2,
  DatabaseBackup,
  FileArchive,
  History,
  Languages,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck
} from 'lucide-react'
import type { AuditEntry, BusinessSettings } from '../../../shared/contracts'
import { Language } from '../i18n'

export function Settings({
  lang,
  onBusinessChange
}: {
  lang: Language
  onBusinessChange?: (settings: BusinessSettings) => void
}): JSX.Element {
  const [busy, setBusy] = useState<'backup' | 'restore' | 'save' | null>(null)
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    let active = true

    void window.desktop.settings.getBusiness()
      .then((settings) => {
        if (active) setBusiness(settings)
      })
      .catch((cause) => {
        if (active) {
          setMessage({
            type: 'error',
            text: cause instanceof Error
              ? cause.message
              : 'Impossible de charger les paramètres.'
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function loadAudit(): Promise<void> {
    try {
      setAuditLoading(true)
      setAuditEntries(await window.desktop.audit.list(80))
    } catch {
      // Audit is supportive UI; primary settings remain usable if it fails.
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    void loadAudit()
  }, [])

  const invoiceExample = useMemo(() => {
    if (!business) return 'F-2026-0001'
    const year = new Date().getFullYear()
    return `${business.invoicePrefix || 'F'}-${year}-${String(1).padStart(
      Math.max(3, Math.min(8, business.invoiceDigits || 4)),
      '0'
    )}`
  }, [business])

  function patchBusiness<K extends keyof BusinessSettings>(
    key: K,
    value: BusinessSettings[K]
  ): void {
    setBusiness((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveBusiness(): Promise<void> {
    if (!business) return

    try {
      setBusy('save')
      setMessage(null)
      const saved = await window.desktop.settings.updateBusiness(business)
      setBusiness(saved)
      onBusinessChange?.(saved)
      setMessage({
        type: 'success',
        text: 'Paramètres enregistrés. Les prochaines factures utiliseront ces informations.'
      })
      await loadAudit()
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer les paramètres.'
      })
    } finally {
      setBusy(null)
    }
  }

  async function createBackup(): Promise<void> {
    try {
      setBusy('backup')
      setMessage(null)
      const result = await window.desktop.backup.create()
      if (result) {
        setMessage({
          type: 'success',
          text: `Sauvegarde créée: ${result.path}`
        })
      }
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'La sauvegarde a échoué.'
      })
    } finally {
      setBusy(null)
    }
  }

  async function restoreBackup(): Promise<void> {
    const confirmed = window.confirm(
      'Restaurer une sauvegarde remplacera les données actuellement enregistrées. ' +
      'Créez d’abord une sauvegarde de sécurité si nécessaire. Continuer ?'
    )
    if (!confirmed) return

    try {
      setBusy('restore')
      setMessage(null)
      const result = await window.desktop.backup.restore()
      if (result) {
        const refreshed = await window.desktop.settings.getBusiness()
        setBusiness(refreshed)
        onBusinessChange?.(refreshed)
        setMessage({
          type: 'success',
          text: `Sauvegarde restaurée et vérifiée (${result.integrity}). Une copie de sécurité des données précédentes a été conservée${result.safetyBackupPath ? `: ${result.safetyBackupPath}` : '.'}`
        })
        await loadAudit()
      }
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'La restauration a échoué.'
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page settings-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Configuration & sécurité</span>
          <h1>Paramètres</h1>
          <p>
            Identité de l’établissement, règles de facturation, langues et protection des données.
          </p>
        </div>
      </section>

      {message && (
        <div className={`inline-alert ${message.type}`}>
          {message.type === 'success' && <CheckCircle2 size={18} />}
          {message.text}
          <button type="button" onClick={() => setMessage(null)}>Fermer</button>
        </div>
      )}

      <div className="settings-grid">
        <section className="panel settings-card business-settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><ShieldCheck size={20} /></span>
            <div>
              <h2>Établissement & facture</h2>
              <p>Ces informations apparaissent sur les nouvelles factures et sont sauvegardées.</p>
            </div>
          </div>

          {!business ? (
            <div className="panel-empty">Chargement des paramètres…</div>
          ) : (
            <>
              <div className="business-settings-form">
                <label className="field">
                  <span>Nom de l’établissement</span>
                  <input
                    value={business.companyName}
                    onChange={(event) => patchBusiness('companyName', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Activité</span>
                  <input
                    value={business.activity}
                    onChange={(event) => patchBusiness('activity', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Nom en arabe</span>
                  <input
                    dir="rtl"
                    value={business.companyNameAr}
                    onChange={(event) => patchBusiness('companyNameAr', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Activité en arabe</span>
                  <input
                    dir="rtl"
                    value={business.activityAr}
                    onChange={(event) => patchBusiness('activityAr', event.target.value)}
                  />
                </label>

                <label className="field full">
                  <span>Adresse</span>
                  <input
                    value={business.address}
                    onChange={(event) => patchBusiness('address', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Téléphone 1</span>
                  <input
                    value={business.phone1}
                    onChange={(event) => patchBusiness('phone1', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Téléphone 2</span>
                  <input
                    value={business.phone2}
                    onChange={(event) => patchBusiness('phone2', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Matricule fiscal</span>
                  <input
                    value={business.taxId}
                    placeholder="À confirmer avec le client"
                    onChange={(event) => patchBusiness('taxId', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>TVA par défaut (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.001"
                    value={business.defaultTaxPercent}
                    onChange={(event) =>
                      patchBusiness('defaultTaxPercent', Number(event.target.value))
                    }
                  />
                </label>

                <label className="field">
                  <span>Préfixe facture</span>
                  <input
                    value={business.invoicePrefix}
                    maxLength={8}
                    onChange={(event) => patchBusiness('invoicePrefix', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Nombre de chiffres</span>
                  <input
                    type="number"
                    min="3"
                    max="8"
                    value={business.invoiceDigits}
                    onChange={(event) =>
                      patchBusiness('invoiceDigits', Number(event.target.value))
                    }
                  />
                </label>

                <label className="field full">
                  <span>Client par défaut</span>
                  <input
                    value={business.defaultCustomerName}
                    onChange={(event) =>
                      patchBusiness('defaultCustomerName', event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="invoice-settings-preview">
                <div>
                  <span>Exemple de numéro</span>
                  <strong>{invoiceExample}</strong>
                </div>
                <div>
                  <span>TVA actuelle</span>
                  <strong>{business.defaultTaxPercent}%</strong>
                </div>
                <div>
                  <span>Matricule fiscal</span>
                  <strong>{business.taxId || 'Non renseigné'}</strong>
                </div>
              </div>

              <div className="settings-save-row">
                <div className="settings-note fiscal-warning">
                  La TVA et le matricule fiscal restent à confirmer avec l’établissement avant la livraison définitive. Aucun identifiant fiscal n’est inventé automatiquement.
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void saveBusiness()}
                >
                  <Save size={17} />
                  {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Languages size={20} /></span>
            <div>
              <h2>Langues</h2>
              <p>Le français reste la langue principale de travail.</p>
            </div>
          </div>

          <div className="language-status-list">
            <div className={lang === 'fr' ? 'active' : ''}>
              <strong>FR</strong>
              <span>Français · principal</span>
            </div>
            <div className={lang === 'en' ? 'active' : ''}>
              <strong>EN</strong>
              <span>English</span>
            </div>
            <div className={lang === 'ar' ? 'active' : ''}>
              <strong>AR</strong>
              <span dir="rtl">العربية · اتجاه RTL</span>
            </div>
          </div>

          <div className="settings-note">
            Changez la langue avec le sélecteur FR / EN / AR dans la barre supérieure.
          </div>
        </section>

        <section className="panel settings-card backup-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><DatabaseBackup size={20} /></span>
            <div>
              <h2>Sauvegarde des données</h2>
              <p>
                Copiez l’intégralité du stock, des factures et des paramètres dans un fichier SQLite vérifiable.
              </p>
            </div>
          </div>

          <div className="backup-actions">
            <button
              className="backup-action primary"
              type="button"
              onClick={() => void createBackup()}
              disabled={busy !== null}
            >
              <span><FileArchive size={20} /></span>
              <div>
                <strong>{busy === 'backup' ? 'Création…' : 'Créer une sauvegarde'}</strong>
                <small>Choisissez le PC, une clé USB ou un disque externe.</small>
              </div>
            </button>

            <button
              className="backup-action"
              type="button"
              onClick={() => void restoreBackup()}
              disabled={busy !== null}
            >
              <span><RotateCcw size={20} /></span>
              <div>
                <strong>{busy === 'restore' ? 'Restauration…' : 'Restaurer une sauvegarde'}</strong>
                <small>Le fichier est contrôlé avant de remplacer les données actives.</small>
              </div>
            </button>
          </div>

          <div className="backup-safety">
            <ShieldCheck size={16} />
            <span>
              La base active reste sur l’ordinateur. La clé USB sert à livrer l’application et à transporter des sauvegardes, ce qui évite de perdre les données si la clé est retirée.
            </span>
          </div>
        </section>

        <section className="panel settings-card audit-card">
          <div className="settings-card-heading audit-heading">
            <span className="settings-icon"><History size={20} /></span>
            <div>
              <h2>Journal d’activité</h2>
              <p>
                Dernières opérations importantes enregistrées localement:
                stock, pièces, clients, factures et paramètres.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Actualiser le journal"
              onClick={() => void loadAudit()}
              disabled={auditLoading}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {auditLoading && auditEntries.length === 0 ? (
            <div className="panel-empty">Chargement du journal…</div>
          ) : auditEntries.length === 0 ? (
            <div className="panel-empty">Aucune activité enregistrée.</div>
          ) : (
            <div className="audit-list">
              {auditEntries.map((entry) => (
                <div className="audit-row" key={entry.id}>
                  <span className="audit-dot" />
                  <div>
                    <strong>{auditLabel(entry)}</strong>
                    <small>{auditDetails(entry)}</small>
                  </div>
                  <time>{formatAuditDate(entry.createdAt, lang)}</time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}


function auditLabel(entry: AuditEntry): string {
  const labels: Record<string, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    ARCHIVE: 'Archivage',
    RESTORE: 'Restauration',
    STOCK_ADJUST: 'Mouvement de stock',
    FINALIZE: 'Facture finalisée',
    SAVE_DRAFT: 'Brouillon enregistré',
    DELETE_DRAFT: 'Brouillon supprimé',
    CANCEL: 'Facture annulée',
    UPDATE_BUSINESS: 'Paramètres établissement modifiés'
  }

  const entityLabels: Record<string, string> = {
    part: 'Pièce',
    client: 'Client',
    supplier: 'Fournisseur',
    invoice: 'Facture',
    settings: 'Paramètres'
  }

  const action = labels[entry.action] ?? entry.action
  const entity = entityLabels[entry.entityType] ?? entry.entityType
  return `${action} · ${entity}`
}

function auditDetails(entry: AuditEntry): string {
  if (!entry.details) {
    return entry.entityId ? `ID ${entry.entityId}` : 'Opération enregistrée'
  }

  const preferred = [
    entry.details.number,
    entry.details.reference,
    entry.details.name,
    entry.details.designation,
    entry.details.reason
  ].find((value) =>
    typeof value === 'string' && value.trim().length > 0
  )

  if (typeof preferred === 'string') return preferred

  if (typeof entry.details.delta === 'number') {
    const delta = entry.details.delta
    return `Variation stock: ${delta > 0 ? '+' : ''}${delta}`
  }

  return entry.entityId ? `ID ${entry.entityId}` : 'Détails enregistrés'
}

function formatAuditDate(value: string, lang: Language): string {
  const parsed = new Date(value.replace(' ', 'T') + 'Z')
  if (Number.isNaN(parsed.getTime())) return value

  const locale =
    lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-TN' : 'fr-TN'

  return parsed.toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}
