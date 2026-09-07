import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { closeDatabase, initializeDatabase } from './database'
import { registerIpcHandlers } from './ipc'

const smokeTest = process.argv.includes('--smoke-test')
let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
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

  window.once('ready-to-show', () => window.show())
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
  smokeTest || app.requestSingleInstanceLock()

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
    .then(() => {
      initializeDatabase()

      if (smokeTest) {
        closeDatabase()
        app.exit(0)
        return
      }

      registerIpcHandlers()
      createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    })
    .catch((error: unknown) => {
      console.error('Application startup failed', error)
      closeDatabase()

      if (!smokeTest) {
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
