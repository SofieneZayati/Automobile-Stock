import type { JSX } from 'react'
import {
  Boxes,
  FileText,
  Gauge,
  Settings,
  Truck,
  Users
} from 'lucide-react'
import type { BusinessSettings } from '../../../shared/contracts'
import { Brand } from './Brand'
import { Language, t } from '../i18n'

export type Page =
  | 'dashboard'
  | 'stock'
  | 'invoices'
  | 'invoiceHistory'
  | 'clients'
  | 'suppliers'
  | 'settings'

type Props = {
  page: Page
  lang: Language
  business: BusinessSettings | null
  onNavigate: (page: Page) => void
}

export function Sidebar({
  page,
  lang,
  business,
  onNavigate
}: Props): JSX.Element {
  const items = [
    { id: 'dashboard' as const, label: t(lang, 'dashboard'), icon: Gauge },
    { id: 'stock' as const, label: t(lang, 'stock'), icon: Boxes },
    {
      id: 'invoiceHistory' as const,
      label: t(lang, 'invoices'),
      icon: FileText
    },
    { id: 'clients' as const, label: t(lang, 'clients'), icon: Users },
    {
      id: 'suppliers' as const,
      label: t(lang, 'suppliers'),
      icon: Truck
    },
    {
      id: 'settings' as const,
      label: t(lang, 'settings'),
      icon: Settings
    }
  ]

  const address =
    business?.address || '31, Rue Chedly Kallala, 1002 Tunis'
  const phones = [
    business?.phone1 || '71 801 813',
    business?.phone2 || '29 276 853'
  ].filter(Boolean)

  return (
    <aside className="sidebar">
      <Brand business={business} />

      <nav className="side-nav" aria-label="Navigation principale">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={
              page === id
              || (id === 'invoiceHistory' && page === 'invoices')
                ? 'nav-item active'
                : 'nav-item'
            }
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
          <strong>{address}</strong>
          <span>{phones.join(' · ')}</span>
          {business?.taxId && <span>MF: {business.taxId}</span>}
        </div>
      </div>
    </aside>
  )
}
