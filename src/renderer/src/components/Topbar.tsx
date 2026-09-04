import { Bell, Search } from 'lucide-react'
import { Language, t } from '../i18n'

type Props = {
  lang: Language
  onLanguage: (language: Language) => void
}

export function Topbar({ lang, onLanguage }: Props): JSX.Element {
  return (
    <header className="topbar">
      <label className="global-search">
        <Search size={19} />
        <input placeholder={t(lang, 'search')} />
        <kbd>Ctrl K</kbd>
      </label>

      <div className="topbar-actions">
        <div className="language-switch" aria-label="Langue">
          {(['fr', 'en', 'ar'] as Language[]).map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => onLanguage(code)}
              className={lang === code ? 'selected' : ''}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>
      </div>
    </header>
  )
}
