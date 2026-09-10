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
import type {
  AuditEntry,
  AutomaticBackupStatus,
  BusinessSettings
} from '../../../shared/contracts'
import { Language, t, tr } from '../i18n'

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
  const [automaticBackup, setAutomaticBackup] =
    useState<AutomaticBackupStatus | null>(null)
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
              : tr(lang, 'Impossible de charger les paramètres.', 'Unable to load settings.', 'تعذر تحميل الإعدادات.')
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

  useEffect(() => {
    void window.desktop.backup.automaticStatus()
      .then(setAutomaticBackup)
      .catch(() => {
        // Manual backup and restore remain available if status cannot be read.
      })
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
        text: tr(lang, 'Paramètres enregistrés. Les prochaines factures utiliseront ces informations.', 'Settings saved. New invoices will use this information.', 'تم حفظ الإعدادات وستستخدمها الفواتير الجديدة.')
      })
      await loadAudit()
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error
          ? cause.message
          : tr(lang, 'Impossible d’enregistrer les paramètres.', 'Unable to save settings.', 'تعذر حفظ الإعدادات.')
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
          text: tr(lang, `Sauvegarde créée: ${result.path}`, `Backup created: ${result.path}`, `تم إنشاء النسخة الاحتياطية: ${result.path}`)
        })
      }
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error ? cause.message : tr(lang, 'La sauvegarde a échoué.', 'Backup failed.', 'فشل إنشاء النسخة الاحتياطية.')
      })
    } finally {
      setBusy(null)
    }
  }

  async function restoreBackup(): Promise<void> {
    const confirmed = window.confirm(
      tr(lang, 'Restaurer une sauvegarde remplacera les données actuellement enregistrées. Créez d’abord une sauvegarde de sécurité si nécessaire. Continuer ?', 'Restoring a backup will replace the currently saved data. Create a safety backup first if needed. Continue?', 'ستؤدي استعادة نسخة احتياطية إلى استبدال البيانات الحالية. أنشئ نسخة أمان أولاً عند الحاجة. هل تريد المتابعة؟')
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
          text: tr(lang, `Sauvegarde restaurée et vérifiée. Une copie de sécurité des données précédentes a été conservée${result.safetyBackupPath ? `: ${result.safetyBackupPath}` : '.'}`, `Backup restored and verified. A safety copy of the previous data was kept${result.safetyBackupPath ? `: ${result.safetyBackupPath}` : '.'}`, `تمت استعادة النسخة والتحقق منها. تم الاحتفاظ بنسخة أمان من البيانات السابقة${result.safetyBackupPath ? `: ${result.safetyBackupPath}` : '.'}`)
        })
        await loadAudit()
      }
    } catch (cause) {
      setMessage({
        type: 'error',
        text: cause instanceof Error ? cause.message : tr(lang, 'La restauration a échoué.', 'Restore failed.', 'فشلت الاستعادة.')
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page settings-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{tr(lang, 'Configuration & sécurité', 'Configuration & safety', 'الإعداد والأمان')}</span>
          <h1>{t(lang, 'settings')}</h1>
          <p>{tr(lang, 'Identité de l’établissement, règles de facturation, langues et protection des données.', 'Shop identity, invoice rules, languages and data protection.', 'هوية المحل وقواعد الفوترة واللغات وحماية البيانات.')}</p>
        </div>
      </section>

      {message && (
        <div className={`inline-alert ${message.type}`}>
          {message.type === 'success' && <CheckCircle2 size={18} />}
          {message.text}
          <button type="button" onClick={() => setMessage(null)}>{tr(lang, 'Fermer', 'Close', 'إغلاق')}</button>
        </div>
      )}

      <div className="settings-grid">
        <section className="panel settings-card business-settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><ShieldCheck size={20} /></span>
            <div>
              <h2>{tr(lang, 'Établissement & facture', 'Shop & invoice', 'المحل والفاتورة')}</h2>
              <p>{tr(lang, 'Ces informations apparaissent sur les nouvelles factures et sont sauvegardées.', 'This information appears on new invoices and is saved.', 'تظهر هذه المعلومات في الفواتير الجديدة ويتم حفظها.')}</p>
            </div>
          </div>

          {!business ? (
            <div className="panel-empty">{tr(lang, 'Chargement des paramètres…', 'Loading settings…', 'جار تحميل الإعدادات…')}</div>
          ) : (
            <>
              <div className="business-settings-form">
                <label className="field">
                  <span>{tr(lang, 'Nom de l’établissement', 'Shop name', 'اسم المحل')}</span>
                  <input
                    value={business.companyName}
                    onChange={(event) => patchBusiness('companyName', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Activité', 'Business activity', 'النشاط')}</span>
                  <input
                    value={business.activity}
                    onChange={(event) => patchBusiness('activity', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Nom en arabe', 'Name in Arabic', 'الاسم بالعربية')}</span>
                  <input
                    dir="rtl"
                    value={business.companyNameAr}
                    onChange={(event) => patchBusiness('companyNameAr', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Activité en arabe', 'Activity in Arabic', 'النشاط بالعربية')}</span>
                  <input
                    dir="rtl"
                    value={business.activityAr}
                    onChange={(event) => patchBusiness('activityAr', event.target.value)}
                  />
                </label>

                <label className="field full">
                  <span>{tr(lang, 'Adresse', 'Address', 'العنوان')}</span>
                  <input
                    value={business.address}
                    onChange={(event) => patchBusiness('address', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Téléphone 1', 'Phone 1', 'الهاتف 1')}</span>
                  <input
                    value={business.phone1}
                    onChange={(event) => patchBusiness('phone1', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Téléphone 2', 'Phone 2', 'الهاتف 2')}</span>
                  <input
                    value={business.phone2}
                    onChange={(event) => patchBusiness('phone2', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Matricule fiscal', 'Tax ID', 'المعرّف الجبائي')}</span>
                  <input
                    value={business.taxId}
                    placeholder="Ex. 1234567/A/M/000"
                    onChange={(event) => patchBusiness('taxId', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'TVA par défaut (%)', 'Default VAT (%)', 'الأداء الافتراضي (%)')}</span>
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
                  <span>{tr(lang, 'Préfixe facture', 'Invoice prefix', 'بادئة الفاتورة')}</span>
                  <input
                    value={business.invoicePrefix}
                    maxLength={8}
                    onChange={(event) => patchBusiness('invoicePrefix', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{tr(lang, 'Nombre de chiffres', 'Number of digits', 'عدد الأرقام')}</span>
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
                  <span>{tr(lang, 'Client par défaut', 'Default customer', 'الحريف الافتراضي')}</span>
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
                  <span>{tr(lang, 'Exemple de numéro', 'Number example', 'مثال الرقم')}</span>
                  <strong>{invoiceExample}</strong>
                </div>
                <div>
                  <span>{tr(lang, 'TVA actuelle', 'Current VAT', 'الأداء الحالي')}</span>
                  <strong>{business.defaultTaxPercent}%</strong>
                </div>
                <div>
                  <span>{tr(lang, 'Matricule fiscal', 'Tax ID', 'المعرّف الجبائي')}</span>
                  <strong>{business.taxId || tr(lang, 'Non renseigné', 'Not entered', 'غير مسجل')}</strong>
                </div>
              </div>

              <div className="settings-save-row">
                <div className="settings-note fiscal-warning">
                  {tr(lang, 'Vérifiez le matricule fiscal, la TVA et la numérotation avant d’émettre les premières factures réelles.', 'Check the tax ID, VAT and numbering before issuing the first real invoices.', 'تحقق من المعرّف الجبائي والأداء والترقيم قبل إصدار أول فاتورة فعلية.')}
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void saveBusiness()}
                >
                  <Save size={17} />
                  {busy === 'save' ? tr(lang, 'Enregistrement…', 'Saving…', 'جار الحفظ…') : tr(lang, 'Enregistrer', 'Save', 'حفظ')}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Languages size={20} /></span>
            <div>
              <h2>{tr(lang, 'Langues', 'Languages', 'اللغات')}</h2>
              <p>{tr(lang, 'Le français reste la langue principale de travail.', 'French remains the main working language.', 'تبقى الفرنسية لغة العمل الأساسية.')}</p>
            </div>
          </div>

          <div className="language-status-list">
            <div className={lang === 'fr' ? 'active' : ''}>
              <strong>FR</strong>
              <span>{tr(lang, 'Français · principal', 'French · main', 'الفرنسية · الرئيسية')}</span>
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
            {tr(lang, 'Changez la langue avec le sélecteur FR / EN / AR dans la barre supérieure.', 'Change language using FR / EN / AR in the top bar.', 'غيّر اللغة باستعمال FR / EN / AR في الشريط العلوي.')}
          </div>
        </section>

        <section className="panel settings-card backup-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><DatabaseBackup size={20} /></span>
            <div>
              <h2>{tr(lang, 'Sauvegarde des données', 'Data backup', 'النسخ الاحتياطي')}</h2>
              <p>{tr(lang, 'Protégez l’intégralité du stock, des factures et des paramètres dans une copie de sécurité.', 'Protect all stock, invoices and settings in a safety copy.', 'احمِ كامل المخزون والفواتير والإعدادات في نسخة أمان.')}</p>
            </div>
          </div>

          <div className="automatic-backup-card">
            <span className="automatic-backup-icon"><ShieldCheck size={19} /></span>
            <div>
              <strong>{tr(lang, 'Sauvegarde automatique quotidienne activée', 'Daily automatic backup is active', 'النسخ الاحتياطي اليومي مفعّل')}</strong>
              <span>
                {automaticBackup?.latestAt
                  ? tr(lang, `Dernière copie: ${formatBackupDate(automaticBackup.latestAt, lang)}`, `Latest copy: ${formatBackupDate(automaticBackup.latestAt, lang)}`, `آخر نسخة: ${formatBackupDate(automaticBackup.latestAt, lang)}`)
                  : tr(lang, 'La première copie sera créée automatiquement après l’ouverture de l’application.', 'The first copy will be created automatically after the app opens.', 'سيتم إنشاء النسخة الأولى تلقائيًا بعد فتح التطبيق.')}
              </span>
              <small>
                {automaticBackup?.folder
                  ?? 'Documents > Ben Mahmoud Stock > Sauvegardes automatiques'}
              </small>
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
                <strong>{busy === 'backup' ? tr(lang, 'Création…', 'Creating…', 'جار الإنشاء…') : tr(lang, 'Créer une sauvegarde', 'Create a backup', 'إنشاء نسخة احتياطية')}</strong>
                <small>{tr(lang, 'Choisissez le PC, une clé USB ou un disque externe.', 'Choose the PC, a USB drive or an external disk.', 'اختر الحاسوب أو مفتاح USB أو قرصًا خارجيًا.')}</small>
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
                <strong>{busy === 'restore' ? tr(lang, 'Restauration…', 'Restoring…', 'جار الاستعادة…') : tr(lang, 'Restaurer une sauvegarde', 'Restore a backup', 'استعادة نسخة احتياطية')}</strong>
                <small>{tr(lang, 'La copie est contrôlée avant de remplacer les données actives.', 'The copy is checked before replacing active data.', 'يتم فحص النسخة قبل استبدال البيانات الحالية.')}</small>
              </div>
            </button>
          </div>

          <div className="backup-safety">
            <ShieldCheck size={16} />
            <span>
              {tr(lang, 'Les données actives restent sur l’ordinateur. La clé USB sert à livrer l’application et à transporter des sauvegardes.', 'Active data stays on the computer. The USB drive is used to deliver the app and carry backups.', 'تبقى البيانات الحالية على الحاسوب. يُستخدم مفتاح USB لنقل التطبيق والنسخ الاحتياطية.')}
            </span>
          </div>
        </section>

        <section className="panel settings-card audit-card">
          <div className="settings-card-heading audit-heading">
            <span className="settings-icon"><History size={20} /></span>
            <div>
              <h2>{tr(lang, 'Journal d’activité', 'Activity log', 'سجل النشاط')}</h2>
              <p>{tr(lang, 'Dernières opérations importantes: stock, pièces, clients, factures et paramètres.', 'Latest important operations: stock, parts, customers, invoices and settings.', 'آخر العمليات المهمة: المخزون والقطع والحرفاء والفواتير والإعدادات.')}</p>
            </div>
            <button
              className="icon-button"
              type="button"
              title={tr(lang, 'Actualiser le journal', 'Refresh activity log', 'تحديث سجل النشاط')}
              onClick={() => void loadAudit()}
              disabled={auditLoading}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {auditLoading && auditEntries.length === 0 ? (
            <div className="panel-empty">{tr(lang, 'Chargement du journal…', 'Loading activity…', 'جار تحميل السجل…')}</div>
          ) : auditEntries.length === 0 ? (
            <div className="panel-empty">{tr(lang, 'Aucune activité enregistrée.', 'No activity recorded.', 'لا يوجد نشاط مسجل.')}</div>
          ) : (
            <div className="audit-list">
              {auditEntries.map((entry) => (
                <div className="audit-row" key={entry.id}>
                  <span className="audit-dot" />
                  <div>
                    <strong>{auditLabel(entry, lang)}</strong>
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


function auditLabel(entry: AuditEntry, lang: Language): string {
  const labels: Record<string, string> = {
    CREATE: tr(lang, 'Création', 'Created', 'إنشاء'),
    UPDATE: tr(lang, 'Modification', 'Updated', 'تعديل'),
    ARCHIVE: tr(lang, 'Archivage', 'Archived', 'أرشفة'),
    RESTORE: tr(lang, 'Restauration', 'Restored', 'استعادة'),
    STOCK_ADJUST: tr(lang, 'Mouvement de stock', 'Stock movement', 'حركة مخزون'),
    FINALIZE: tr(lang, 'Facture finalisée', 'Invoice finalized', 'تأكيد فاتورة'),
    SAVE_DRAFT: tr(lang, 'Brouillon enregistré', 'Draft saved', 'حفظ مسودة'),
    DELETE_DRAFT: tr(lang, 'Brouillon supprimé', 'Draft deleted', 'حذف مسودة'),
    CANCEL: tr(lang, 'Facture annulée', 'Invoice cancelled', 'إلغاء فاتورة'),
    RETURN: tr(lang, 'Retour client', 'Customer return', 'إرجاع حريف'),
    UPDATE_BUSINESS: tr(lang, 'Paramètres établissement modifiés', 'Shop settings updated', 'تعديل إعدادات المحل')
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

function formatBackupDate(value: string, lang: Language): string {
  const date = new Date(value)
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-TN' : 'fr-TN'
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}
