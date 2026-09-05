import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX
} from 'react'
import { Search } from 'lucide-react'
import { Language, t } from '../i18n'

type Props = {
  lang: Language
  onLanguage: (language: Language) => void
  onSearch: (query: string) => void
}

export function Topbar({
  lang,
  onLanguage,
  onSearch
}: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const value = query.trim()
    if (!value) {
      inputRef.current?.focus()
      return
    }
    onSearch(value)
  }

  return (
    <header className="topbar">
      <form className="global-search" onSubmit={submit}>
        <Search size={19} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(lang, 'search')}
          aria-label={t(lang, 'search')}
        />
        <kbd>Ctrl K</kbd>
      </form>

      <div className="topbar-actions">
        <span className="local-status" title="Données stockées localement">
          Local
        </span>
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
      </div>
    </header>
  )
}
