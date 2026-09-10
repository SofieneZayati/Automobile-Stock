import { useEffect, useState, type JSX } from 'react'
import type { BusinessSettings, FinalizedInvoice } from '../../shared/contracts'
import { Sidebar, Page } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Invoices, type InvoiceCustomerPrefill } from './pages/Invoices'
import { InvoiceHistory } from './pages/InvoiceHistory'
import { Clients } from './pages/Clients'
import { Suppliers } from './pages/Suppliers'
import { Settings } from './pages/Settings'
import { Stock } from './pages/Stock'
import { Reports } from './pages/Reports'
import { Language } from './i18n'

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('dashboard')
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [invoiceDirty, setInvoiceDirty] = useState(false)
  const [invoiceCustomerPrefill, setInvoiceCustomerPrefill] =
    useState<InvoiceCustomerPrefill | null>(null)
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

  useEffect(() => {
    if (!invoiceDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () =>
      window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [invoiceDirty])

  function navigate(nextPage: Page): void {
    if (
      page === 'invoices'
      && nextPage !== 'invoices'
      && invoiceDirty
    ) {
      const confirmed = window.confirm(
        'Cette facture contient des modifications non enregistrées. ' +
        'Quitter cette page et perdre ces modifications ?'
      )
      if (!confirmed) return
      setInvoiceDirty(false)
    }

    setPage(nextPage)
  }

  function globalSearch(query: string): void {
    setStockSearch((current) => ({
      query,
      requestId: current.requestId + 1
    }))
    navigate('stock')
  }

  function startExchange(invoice: FinalizedInvoice): void {
    setInvoiceDirty(false)
    setInvoiceCustomerPrefill({
      key: `${invoice.id}-${Date.now()}`,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      customerTaxId: invoice.customerTaxId,
      sourceInvoiceNumber: invoice.number
    })
    setPage('invoices')
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        lang={lang}
        business={business}
        onNavigate={navigate}
      />

      <main className="workspace">
        <Topbar
          lang={lang}
          onLanguage={setLang}
          onSearch={globalSearch}
        />

        <div className="content-scroll">
          {page === 'dashboard' && (
            <Dashboard lang={lang} onNavigate={navigate} />
          )}
          {page === 'stock' && (
            <Stock
              lang={lang}
              initialQuery={stockSearch.query}
              searchRequestId={stockSearch.requestId}
            />
          )}
          {page === 'invoices' && (
            <Invoices
              lang={lang}
              onDirtyChange={setInvoiceDirty}
              customerPrefill={invoiceCustomerPrefill}
            />
          )}
          {page === 'invoiceHistory' && (
            <InvoiceHistory
              lang={lang}
              onNavigate={navigate}
              onStartExchange={startExchange}
            />
          )}
          {page === 'reports' && <Reports lang={lang} />}
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
