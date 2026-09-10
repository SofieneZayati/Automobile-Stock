import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { migrations } from './migrations'

let database: DatabaseSync | null = null

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'automobile-stock.sqlite3')
}

export function getDatabase(): DatabaseSync {
  if (!database) throw new Error('Database has not been initialized')
  return database
}

export function initializeDatabase(): DatabaseSync {
  if (database) return database

  const dataDir = app.getPath('userData')
  mkdirSync(dataDir, { recursive: true })
  const databasePath = getDatabasePath()

  if (!existsSync(databasePath)) {
    const seedPath = app.isPackaged
      ? join(process.resourcesPath, 'initial-database.sqlite3')
      : join(app.getAppPath(), 'resources', 'initial-database.sqlite3')

    if (existsSync(seedPath)) {
      copyFileSync(seedPath, databasePath)
    }
  }

  database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec('PRAGMA journal_mode = WAL;')
  database.exec('PRAGMA synchronous = NORMAL;')
  database.exec('PRAGMA busy_timeout = 5000;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  applyMigrations(database)
  assertDatabaseIntegrity(database)

  return database
}

export function closeDatabase(): void {
  database?.close()
  database = null
}

function assertDatabaseIntegrity(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA quick_check;').get() as
    | Record<string, string>
    | undefined

  const result = row ? Object.values(row)[0] : 'unknown'
  if (result !== 'ok') {
    throw new Error(
      `La base de données locale a échoué au contrôle d’intégrité: ${result}. ` +
      'N’écrasez pas vos sauvegardes; restaurez une copie valide.'
    )
  }
}

function applyMigrations(db: DatabaseSync): void {
  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>
  const applied = new Set(appliedRows.map((row) => row.version))

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue

    db.exec('BEGIN IMMEDIATE;')
    try {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(migration.version, migration.name)
      db.exec('COMMIT;')
    } catch (error) {
      db.exec('ROLLBACK;')
      throw error
    }
  }
}
