import { dialog, app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  initializeDatabase
} from '../database'
import type { BackupResult, RestoreResult } from '../../shared/contracts'

export async function createBackup(): Promise<BackupResult | null> {
  const stamp = new Intl.DateTimeFormat('en-CA').format(new Date())
  const defaultName = `Ben-Mahmoud-Stock-Backup-${stamp}.sqlite3`

  const result = await dialog.showSaveDialog({
    title: 'Sauvegarder les données Ben Mahmoud Stock',
    defaultPath: join(app.getPath('documents'), defaultName),
    buttonLabel: 'Créer la sauvegarde',
    filters: [{ name: 'Sauvegarde SQLite', extensions: ['sqlite3'] }]
  })

  if (result.canceled || !result.filePath) return null

  const target = result.filePath.toLowerCase().endsWith('.sqlite3')
    ? result.filePath
    : `${result.filePath}.sqlite3`

  const db = getDatabase()
  db.exec('PRAGMA wal_checkpoint(FULL);')
  rmSync(target, { force: true })
  db.exec(`VACUUM INTO '${escapeSqlString(target)}';`)

  return { path: target }
}

export async function restoreBackup(): Promise<RestoreResult | null> {
  const result = await dialog.showOpenDialog({
    title: 'Restaurer une sauvegarde Ben Mahmoud Stock',
    defaultPath: app.getPath('documents'),
    buttonLabel: 'Restaurer',
    properties: ['openFile'],
    filters: [{
      name: 'Sauvegarde SQLite',
      extensions: ['sqlite3', 'db', 'sqlite']
    }]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const source = result.filePaths[0]
  const destination = getDatabasePath()

  if (resolve(source) === resolve(destination)) {
    throw new Error(
      'Le fichier sélectionné est déjà la base de données active.'
    )
  }

  const integrity = validateBackup(source)
  const activeDb = getDatabase()
  activeDb.exec('PRAGMA wal_checkpoint(FULL);')

  closeDatabase()

  const safetyBackupPath = createPreRestoreSafetyCopy(destination)

  try {
    rmSync(`${destination}-wal`, { force: true })
    rmSync(`${destination}-shm`, { force: true })
    copyFileSync(source, destination)
    initializeDatabase()
  } catch (error) {
    try {
      closeDatabase()
      if (safetyBackupPath && existsSync(safetyBackupPath)) {
        copyFileSync(safetyBackupPath, destination)
      }
      initializeDatabase()
    } catch {
      // Preserve the original restore error. The safety file remains on disk.
    }
    throw error
  }

  return {
    path: source,
    integrity,
    safetyBackupPath
  }
}

function createPreRestoreSafetyCopy(destination: string): string | null {
  if (!existsSync(destination)) return null

  const folder = join(app.getPath('userData'), 'restore-safety')
  mkdirSync(folder, { recursive: true })

  const stamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-')
  const target = join(
    folder,
    `Ben-Mahmoud-Stock-Pre-Restore-${stamp}.sqlite3`
  )

  copyFileSync(destination, target)
  pruneSafetyCopies(folder)
  return target
}

function pruneSafetyCopies(folder: string): void {
  // Keep cleanup intentionally conservative for now. Safety copies are
  // small compared with the risk of losing the shop's active database.
  void folder
}

function validateBackup(path: string): string {
  const candidate = new DatabaseSync(path)
  try {
    const integrityRow = candidate.prepare(
      'PRAGMA quick_check;'
    ).get() as Record<string, string> | undefined
    const integrity = integrityRow
      ? Object.values(integrityRow)[0]
      : 'unknown'

    if (integrity !== 'ok') {
      throw new Error(`La sauvegarde SQLite est invalide: ${integrity}`)
    }

    const migrationTable = candidate.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'schema_migrations'
    `).get()

    if (!migrationTable) {
      throw new Error(
        'Ce fichier ne ressemble pas à une sauvegarde Ben Mahmoud Stock.'
      )
    }

    return integrity
  } finally {
    candidate.close()
  }
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}
