import { app, BrowserWindow, dialog, shell } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { closeDatabase, initializeDatabase } from './database'
import { runIntegrationTest } from './integration-test'
import { registerIpcHandlers } from './ipc'
import { createAutomaticBackup } from './services/backup'

const smokeTest = process.argv.includes('--smoke-test')
const integrationTest = process.argv.includes('--integration-test')
const uiSmokeTest = process.argv.includes('--ui-smoke-test')
const testDataArgument = process.argv.find((argument) =>
  argument.startsWith('--test-data-dir=')
)

if ((smokeTest || integrationTest || uiSmokeTest) && testDataArgument) {
  const testDataDir = testDataArgument.slice('--test-data-dir='.length)
  if (testDataDir) {
    const resolvedTestDataDir = resolve(testDataDir)
    const testDocumentsDir = join(resolvedTestDataDir, 'Documents')
    mkdirSync(testDocumentsDir, { recursive: true })
    app.setPath('userData', resolvedTestDataDir)
    app.setPath('documents', testDocumentsDir)
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(showWhenReady = true): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f6f8',
    title: 'Ben Mahmoud Stock',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (showWhenReady) {
    window.once('ready-to-show', () => window.show())
  }
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(
      join(__dirname, '../renderer/index.html')
    )
  }

  mainWindow = window
  return window
}

const hasInstanceLock =
  smokeTest || integrationTest || uiSmokeTest || app.requestSingleInstanceLock()

if (!hasInstanceLock) {
  app.quit()
} else {
  if (!smokeTest) {
    app.on('second-instance', () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })
  }

  app.whenReady()
    .then(async () => {
      initializeDatabase()

      if (integrationTest) {
        runIntegrationTest()
        closeDatabase()
        app.exit(0)
        return
      }

      if (smokeTest) {
        closeDatabase()
        app.exit(0)
        return
      }

      registerIpcHandlers()
      const window = createWindow(!uiSmokeTest)

      if (!smokeTest && !integrationTest && !uiSmokeTest) {
        setTimeout(() => {
          try {
            createAutomaticBackup()
          } catch (error) {
            console.error('Automatic backup failed', error)
          }
        }, 1500)
      }

      if (uiSmokeTest) {
        await runUiSmokeTest(window)
        closeDatabase()
        window.destroy()
        app.exit(0)
        return
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    })
    .catch((error: unknown) => {
      console.error('Application startup failed', error)
      closeDatabase()

      if (!smokeTest && !integrationTest && !uiSmokeTest) {
        const detail =
          error instanceof Error
            ? error.message
            : 'Erreur inconnue lors du démarrage.'

        dialog.showErrorBox(
          'Ben Mahmoud Stock — démarrage impossible',
          'L’application n’a pas pu ouvrir ses données locales. ' +
          'Aucune modification n’a été effectuée.\n\n' +
          detail +
          '\n\nSi le problème persiste, conservez vos sauvegardes avant toute réinstallation.'
        )
      }

      app.exit(1)
    })
}

app.on('before-quit', () => {
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

async function runUiSmokeTest(window: BrowserWindow): Promise<void> {
  const readyDeadline = Date.now() + 10000
  while (true) {
    const ready = await window.webContents.executeJavaScript(
      "document.readyState === 'complete' && Boolean(document.getElementById('root')?.children.length)"
    ).catch(() => false) as boolean
    if (ready) break
    if (Date.now() >= readyDeadline) {
      throw new Error('L’interface n’a pas terminé son chargement dans le délai prévu.')
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }

  const reportPage = await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('.side-nav button')].find(
        (element) => element.textContent?.trim() === 'Ventes'
      )
      if (!(button instanceof HTMLButtonElement)) return false
      button.click()
      return true
    })()
  `) as boolean
  if (!reportPage) throw new Error('La page Ventes est introuvable.')
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120))
  const reportVisible = await window.webContents.executeJavaScript(`({
    title: document.querySelector('h1')?.textContent?.trim() ?? '',
    summaryCards: document.querySelectorAll('.report-stats .stat-card').length
  })`) as { title: string; summaryCards: number }
  if (reportVisible.title !== 'Ventes' || reportVisible.summaryCards < 4) {
    throw new Error('Le rapport des ventes ne s’affiche pas correctement.')
  }

  await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('.side-nav button')].find(
      (element) => element.textContent?.trim() === 'Factures'
    )?.click()
  `)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 80))

  const clicked = await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === 'Nouvelle facture'
      )
      if (!(button instanceof HTMLButtonElement)) return false
      button.click()
      return true
    })()
  `) as boolean
  if (!clicked) throw new Error('Le bouton Nouvelle facture est introuvable.')

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150))

  const result = await window.webContents.executeJavaScript(`
    (() => {
      const labels = [...document.querySelectorAll('label')]
        .map((label) => label.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
      const phone = document.querySelector('input[inputmode="tel"]')

      return {
        title: document.querySelector('h1')?.textContent?.trim() ?? '',
        hasLocalBadge: Boolean(document.querySelector('.local-status')),
        hasCustomerPhone: phone instanceof HTMLInputElement,
        phoneLabel: labels.find((label) => label.startsWith('Téléphone client')) ?? '',
        customerDetailInputs: document.querySelectorAll('.invoice-customer-details input').length
      }
    })()
  `) as {
    title: string
    hasLocalBadge: boolean
    hasCustomerPhone: boolean
    phoneLabel: string
    customerDetailInputs: number
  }

  await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'AR')?.click()
  `)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  const arabicLanguage = await window.webContents.executeJavaScript(`({
    direction: document.documentElement.dir,
    title: document.querySelector('h1')?.textContent?.trim() ?? ''
  })`) as { direction: string; title: string }

  await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'EN')?.click()
  `)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  const englishLanguage = await window.webContents.executeJavaScript(`({
    direction: document.documentElement.dir,
    title: document.querySelector('h1')?.textContent?.trim() ?? '',
    phoneLabel: [...document.querySelectorAll('label')]
      .map((label) => label.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
      .find((label) => label.startsWith('Customer phone')) ?? '',
    paperTitle: document.querySelector('.paper-title > span')?.textContent?.trim() ?? ''
  })`) as {
    direction: string
    title: string
    phoneLabel: string
    paperTitle: string
  }

  await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'FR')?.click()
  `)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))

  const customerFilled = await window.webContents.executeJavaScript(`
    (() => {
      const setValue = (element, value) => {
        const prototype = element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        if (!setter) return false
        setter.call(element, value)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }

      const name = document.querySelector('.invoice-customer-row input')
      const details = [...document.querySelectorAll('.invoice-customer-details input')]
      const note = document.querySelector('.invoice-note-field textarea')
      if (
        !(name instanceof HTMLInputElement)
        || details.length !== 3
        || !(note instanceof HTMLTextAreaElement)
      ) return false

      return [
        setValue(name, 'Garage El Menzah'),
        setValue(details[0], '22 333 444'),
        setValue(details[1], '12, rue de la Mécanique, El Menzah'),
        setValue(details[2], '1234567/A/M/000'),
        setValue(
          note,
          'Merci pour votre confiance. Garantie selon les conditions du fabricant.'
        )
      ].every(Boolean)
    })()
  `) as boolean
  if (!customerFilled) {
    throw new Error('Les coordonnées de contrôle n’ont pas pu être saisies.')
  }

  for (let index = 0; index < 2; index += 1) {
    const pickerOpened = await window.webContents.executeJavaScript(`
      (() => {
        const button = document.querySelector('.part-search-button')
        if (!(button instanceof HTMLButtonElement)) return false
        button.click()
        return true
      })()
    `) as boolean
    if (!pickerOpened) throw new Error('Le sélecteur de pièces ne s’ouvre pas.')

    const pickerDeadline = Date.now() + 5000
    while (true) {
      const rowCount = await window.webContents.executeJavaScript(
        "document.querySelectorAll('.picker-row').length"
      ) as number
      if (rowCount > index) break
      if (Date.now() >= pickerDeadline) {
        throw new Error('Les pièces de départ ne sont pas visibles dans le sélecteur.')
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
    }

    await window.webContents.executeJavaScript(`
      [...document.querySelectorAll('.picker-row')][${index}]?.click()
    `)
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80))
  }

  await window.webContents.executeJavaScript(`
    document.querySelector('.content-scroll')?.scrollTo(0, 0)
  `)

  const invoiceVisual = await window.webContents.executeJavaScript(`
    (() => {
      const appLogo = document.querySelector('.brand-logo')
      const paperLogo = document.querySelector('.paper-logo')
      const paper = document.querySelector('.invoice-paper')
      const textElements = [...document.querySelectorAll(
        '.invoice-paper .paper-brand strong, .invoice-paper .paper-brand span, ' +
        '.invoice-paper .paper-brand small, .invoice-paper .paper-title span, ' +
        '.invoice-paper .paper-title strong, .invoice-paper .paper-title small, ' +
        '.invoice-paper .paper-meta *, .invoice-paper th, .invoice-paper td, ' +
        '.invoice-paper .paper-note *, .invoice-paper .paper-totals *, ' +
        '.invoice-paper .paper-footer *'
      )].filter((element) => element.textContent?.trim())
      const sizes = textElements.map(
        (element) => Number.parseFloat(getComputedStyle(element).fontSize)
      )
      const clippingTargets = [...document.querySelectorAll(
        '.paper-brand > div:last-child, .paper-title, .paper-meta > div, ' +
        '.paper-table th, .paper-table td, .paper-note, .paper-totals, .paper-footer'
      )]

      return {
        hasUnifiedLogo:
          appLogo instanceof HTMLImageElement
          && paperLogo instanceof HTMLImageElement
          && appLogo.src === paperLogo.src
          && appLogo.naturalWidth > 0
          && paperLogo.naturalWidth > 0,
        lineCount: document.querySelectorAll('.paper-table tbody tr').length,
        minimumTextSize: sizes.length ? Math.min(...sizes) : 0,
        clippedElements: clippingTargets.filter(
          (element) => element.scrollWidth > element.clientWidth + 1
            || element.scrollHeight > element.clientHeight + 1
        ).length,
        paperOverflow: paper
          ? paper.scrollWidth > paper.clientWidth + 1
          : true
      }
    })()
  `) as {
    hasUnifiedLogo: boolean
    lineCount: number
    minimumTextSize: number
    clippedElements: number
    paperOverflow: boolean
  }

  if (!result.title) throw new Error('Le titre de la page facture est vide.')
  if (result.hasLocalBadge) {
    throw new Error('L’indicateur Local est encore visible dans la barre supérieure.')
  }
  if (!result.hasCustomerPhone || !result.phoneLabel) {
    throw new Error('Le champ téléphone client n’est pas visible dans la nouvelle facture.')
  }
  if (result.customerDetailInputs !== 3) {
    throw new Error('Les coordonnées client ne contiennent pas les trois champs attendus.')
  }
  if (arabicLanguage.direction !== 'rtl' || englishLanguage.direction !== 'ltr') {
    throw new Error('Le sens de lecture ne suit pas la langue sélectionnée.')
  }
  if (!arabicLanguage.title.includes('فاتورة')) {
    throw new Error('Le titre de la facture ne passe pas en arabe.')
  }
  if (englishLanguage.title !== 'Invoice draft' || !englishLanguage.phoneLabel) {
    throw new Error('Les commandes de facturation ne passent pas correctement en anglais.')
  }
  if (englishLanguage.paperTitle !== 'FACTURE') {
    throw new Error('Le document imprimé ne conserve pas sa présentation française.')
  }
  if (!invoiceVisual.hasUnifiedLogo) {
    throw new Error('Le logo de l’application et celui de la facture ne correspondent pas.')
  }
  if (invoiceVisual.lineCount < 2) {
    throw new Error('L’aperçu de facture ne contient pas les lignes attendues.')
  }
  if (invoiceVisual.minimumTextSize < 9) {
    throw new Error(`Un texte de facture est trop petit: ${invoiceVisual.minimumTextSize}px.`)
  }
  if (invoiceVisual.clippedElements > 0 || invoiceVisual.paperOverflow) {
    throw new Error('Un texte ou un bloc déborde dans l’aperçu de facture.')
  }

  await window.webContents.executeJavaScript(`
    new Promise((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    })
  `)

  const screenshotArgument = process.argv.find((argument) =>
    argument.startsWith('--screenshot-path=')
  )
  if (screenshotArgument) {
    const screenshotPath = resolve(
      screenshotArgument.slice('--screenshot-path='.length)
    )
    mkdirSync(dirname(screenshotPath), { recursive: true })
    const screenshot = await window.webContents.capturePage()
    writeFileSync(screenshotPath, screenshot.toPNG())
  }

  const pdfArgument = process.argv.find((argument) =>
    argument.startsWith('--pdf-path=')
  )
  if (pdfArgument) {
    const pdfPath = resolve(pdfArgument.slice('--pdf-path='.length))
    mkdirSync(dirname(pdfPath), { recursive: true })
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      landscape: false
    })
    writeFileSync(pdfPath, pdf)
  }

  console.log('UI smoke test passed:', JSON.stringify({
    ...result,
    arabicLanguage,
    englishLanguage,
    invoiceVisual
  }))
}
