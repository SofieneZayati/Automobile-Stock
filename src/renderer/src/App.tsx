import { useEffect, useState, type JSX } from 'react'
import { Sidebar, Page } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Invoices } from './pages/Invoices'
import { Stock } from './pages/Stock'
import { Language } from './i18n'

function Placeholder({ title, text }: { title: string; text: string }): JSX.Element {
  return (
    <div className="page">
      <section className="page-heading"><div><span className="eyebrow">Module prévu</span><h1>{title}</h1><p>{text}</p></div></section>
      <section className="panel placeholder-panel"><div className="placeholder-mark">BM</div><h2>Fondation prête</h2><p>Ce module sera connecté à la base SQLite pendant la prochaine phase.</p></section>
    </div>
  )
}

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('dashboard')
  const [lang, setLang] = useState<Language>('fr')

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  return (
    <div className="app-shell">
      <Sidebar page={page} lang={lang} onNavigate={setPage} />
      <main className="workspace">
        <Topbar lang={lang} onLanguage={setLang} />
        <div className="content-scroll">
          {page === 'dashboard' && <Dashboard lang={lang} onNavigate={setPage} />}
          {page === 'stock' && <Stock lang={lang} />}
          {page === 'invoices' && <Invoices lang={lang} />}
          {page === 'clients' && <Placeholder title="Clients" text="Fiches clients simples, historique des factures et recherche rapide." />}
          {page === 'settings' && <Placeholder title="Paramètres" text="Identité société, numérotation, fiscalité, imprimante, sauvegardes et langue." />}
        </div>
      </main>
    </div>
  )
}
