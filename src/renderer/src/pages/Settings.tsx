import { useState, type JSX } from 'react'
import { CheckCircle2, DatabaseBackup, FileArchive, Languages, RotateCcw, ShieldCheck } from 'lucide-react'
import { Language } from '../i18n'

export function Settings({ lang }: { lang: Language }): JSX.Element {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function createBackup(): Promise<void> {
    try {
      setBusy('backup')
      setMessage(null)
      const result = await window.desktop.backup.create()
      if (result) {
        setMessage({ type: 'success', text: `Sauvegarde créée: ${result.path}` })
      }
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'La sauvegarde a échoué.' })
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
        setMessage({
          type: 'success',
          text: `Sauvegarde restaurée et vérifiée (${result.integrity}). Ouvrez Stock ou Factures pour contrôler les données.`
        })
      }
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'La restauration a échoué.' })
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
          <p>Identité de l’établissement, langues et protection des données locales.</p>
        </div>
      </section>

      {message && <div className={`inline-alert ${message.type}`}>
        {message.type === 'success' && <CheckCircle2 size={18} />}
        {message.text}
        <button type="button" onClick={() => setMessage(null)}>Fermer</button>
      </div>}

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><ShieldCheck size={20} /></span>
            <div><h2>Établissement</h2><p>Informations utilisées pour l’identité visuelle et les factures.</p></div>
          </div>
          <div className="company-settings-summary">
            <div><span>Nom</span><strong>Etablissement Ben Mahmoud</strong></div>
            <div><span>Activité</span><strong>Équipement Automobiles</strong></div>
            <div><span>العربية</span><strong dir="rtl">مؤسسة بن محمود · تجهيز السيارات</strong></div>
            <div><span>Adresse</span><strong>31, Rue Chedly Kallala, 1002 Tunis</strong></div>
            <div><span>Téléphones</span><strong>71 801 813 · 29 276 853</strong></div>
          </div>
          <div className="settings-note">
            Le matricule fiscal, le mode HT/TTC et les règles fiscales seront rendus modifiables avant la livraison client.
          </div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Languages size={20} /></span>
            <div><h2>Langues</h2><p>Le français reste la langue principale de travail.</p></div>
          </div>
          <div className="language-status-list">
            <div className={lang === 'fr' ? 'active' : ''}><strong>FR</strong><span>Français · principal</span></div>
            <div className={lang === 'en' ? 'active' : ''}><strong>EN</strong><span>English</span></div>
            <div className={lang === 'ar' ? 'active' : ''}><strong>AR</strong><span dir="rtl">العربية · اتجاه RTL</span></div>
          </div>
          <div className="settings-note">Changez la langue avec le sélecteur FR / EN / AR dans la barre supérieure.</div>
        </section>

        <section className="panel settings-card backup-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><DatabaseBackup size={20} /></span>
            <div><h2>Sauvegarde des données</h2><p>Copiez l’intégralité du stock et des factures dans un fichier SQLite vérifiable.</p></div>
          </div>

          <div className="backup-actions">
            <button className="backup-action primary" type="button" onClick={() => void createBackup()} disabled={busy !== null}>
              <span><FileArchive size={20} /></span>
              <div><strong>{busy === 'backup' ? 'Création…' : 'Créer une sauvegarde'}</strong><small>Choisissez le PC, une clé USB ou un disque externe.</small></div>
            </button>
            <button className="backup-action" type="button" onClick={() => void restoreBackup()} disabled={busy !== null}>
              <span><RotateCcw size={20} /></span>
              <div><strong>{busy === 'restore' ? 'Restauration…' : 'Restaurer une sauvegarde'}</strong><small>Le fichier est contrôlé avant de remplacer les données actives.</small></div>
            </button>
          </div>

          <div className="backup-safety">
            <ShieldCheck size={16} />
            <span>La base active reste sur l’ordinateur. La clé USB sert à livrer l’application et à transporter des sauvegardes, ce qui évite de perdre les données si la clé est retirée.</span>
          </div>
        </section>
      </div>
    </div>
  )
}
