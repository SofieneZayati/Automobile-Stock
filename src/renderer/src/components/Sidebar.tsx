import type { JSX } from 'react'
import { Boxes, FileText, Gauge, Settings, Users } from 'lucide-react'
import { Brand } from './Brand'
import { Language, t } from '../i18n'

export type Page = 'dashboard' | 'stock' | 'invoices' | 'invoiceHistory' | 'clients' | 'settings'

type Props = {
  page: Page
  lang: Language
  onNavigate: (page: Page) => void
}

export function Sidebar({ page, lang, onNavigate }: Props): JSX.Element {
  const items = [
    { id: 'dashboard' as const, label: t(lang, 'dashboard'), icon: Gauge },
    { id: 'stock' as const, label: t(lang, 'stock'), icon: Boxes },
    { id: 'invoiceHistory' as const, label: t(lang, 'invoices'), icon: FileText },
    { id: 'clients' as const, label: t(lang, 'clients'), icon: Users },
    { id: 'settings' as const, label: t(lang, 'settings'), icon: Settings }
  ]

  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="Navigation principale">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={(page === id || (id === 'invoiceHistory' && page === 'invoices')) ? 'nav-item active' : 'nav-item'}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} strokeWidth={1.9} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-card">
        <div className="sidebar-card-icon">BM</div>
        <div>
          <strong>31, Rue Chedly Kallala</strong>
          <span>1002 Tunis</span>
          <span>71 801 813 · 29 276 853</span>
        </div>
      </div>
    </aside>
  )
}
