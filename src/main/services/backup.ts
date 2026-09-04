import { dialog, app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { closeDatabase, getDatabase, getDatabasePath, initializeDatabase } from '../database'
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
    filters: [{ name: 'Sauvegarde SQLite', extensions: ['sqlite3', 'db', 'sqlite'] }]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const source = result.filePaths[0]
  const destination = getDatabasePath()

  if (resolve(source) === resolve(destination)) {
    throw new Error('Le fichier sélectionné est déjà la base de données active.')
  }

  const integrity = validateBackup(source)

  closeDatabase()
  try {
    rmSync(`${destination}-wal`, { force: true })
    rmSync(`${destination}-shm`, { force: true })
    copyFileSync(source, destination)
    initializeDatabase()
  } catch (error) {
    initializeDatabase()
    throw error
  }

  return { path: source, integrity }
}

function validateBackup(path: string): string {
  const candidate = new DatabaseSync(path)
  try {
    const integrityRow = candidate.prepare('PRAGMA quick_check;').get() as Record<string, string> | undefined
    const integrity = integrityRow ? Object.values(integrityRow)[0] : 'unknown'
    if (integrity !== 'ok') {
      throw new Error(`La sauvegarde SQLite est invalide: ${integrity}`)
    }

    const migrationTable = candidate.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'schema_migrations'
    `).get()

    if (!migrationTable) {
      throw new Error('Ce fichier ne ressemble pas à une sauvegarde Ben Mahmoud Stock.')
    }

    return integrity
  } finally {
    candidate.close()
  }
}

export function describeBackupPath(path: string): string {
  return join(dirname(path), basename(path))
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}
