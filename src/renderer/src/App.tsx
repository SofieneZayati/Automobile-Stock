import { useEffect, useState, type JSX } from 'react'
import type { BusinessSettings } from '../../shared/contracts'
import { Sidebar, Page } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Invoices } from './pages/Invoices'
import { InvoiceHistory } from './pages/InvoiceHistory'
import { Clients } from './pages/Clients'
import { Suppliers } from './pages/Suppliers'
import { Settings } from './pages/Settings'
import { Stock } from './pages/Stock'
import { Language } from './i18n'

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('dashboard')
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [stockSearch, setStockSearch] = useState({
    query: '',
    requestId: 0
  })
  const [lang, setLang] = useState<Language>(() => {
    const stored = window.localStorage.getItem('ben-mahmoud-language')
    return stored === 'en' || stored === 'ar' ? stored : 'fr'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem('ben-mahmoud-language', lang)
  }, [lang])

  useEffect(() => {
    let active = true
    void window.desktop.settings.getBusiness()
      .then((settings) => {
        if (active) setBusiness(settings)
      })
      .catch(() => {
        // Page-level settings UI reports configuration errors when opened.
      })

    return () => {
      active = false
    }
  }, [])

  function globalSearch(query: string): void {
    setStockSearch((current) => ({
      query,
      requestId: current.requestId + 1
    }))
    setPage('stock')
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        lang={lang}
        business={business}
        onNavigate={setPage}
      />

      <main className="workspace">
        <Topbar
          lang={lang}
          onLanguage={setLang}
          onSearch={globalSearch}
        />

        <div className="content-scroll">
          {page === 'dashboard' && (
            <Dashboard lang={lang} onNavigate={setPage} />
          )}
          {page === 'stock' && (
            <Stock
              lang={lang}
              initialQuery={stockSearch.query}
              searchRequestId={stockSearch.requestId}
            />
          )}
          {page === 'invoices' && <Invoices lang={lang} />}
          {page === 'invoiceHistory' && (
            <InvoiceHistory lang={lang} onNavigate={setPage} />
          )}
          {page === 'clients' && <Clients lang={lang} />}
          {page === 'suppliers' && <Suppliers lang={lang} />}
          {page === 'settings' && (
            <Settings
              lang={lang}
              onBusinessChange={setBusiness}
            />
          )}
        </div>
      </main>
    </div>
  )
}
