import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { migrations } from './migrations'

let database: DatabaseSync | null = null

export function getDatabase(): DatabaseSync {
  if (!database) throw new Error('Database has not been initialized')
  return database
}

export function initializeDatabase(): DatabaseSync {
  if (database) return database

  const dataDir = app.getPath('userData')
  mkdirSync(dataDir, { recursive: true })
  const databasePath = join(dataDir, 'automobile-stock.sqlite3')

  database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec('PRAGMA journal_mode = WAL;')
  database.exec('PRAGMA synchronous = NORMAL;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  applyMigrations(database)

  if (!app.isPackaged) {
    ensureDevelopmentSeed(database)
  }

  return database
}

export function closeDatabase(): void {
  database?.close()
  database = null
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

function ensureDevelopmentSeed(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM parts').get() as { count: number }
  if (row.count > 0) return

  const categories = ['Filtration', 'Freinage', 'Moteur', 'Direction', 'Carrosserie']
  const categoryStmt = db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)')
  for (const category of categories) categoryStmt.run(category)

  const categoryRows = db.prepare('SELECT id, name FROM categories').all() as Array<{ id: number; name: string }>
  const categoryId = new Map(categoryRows.map((item) => [item.name, item.id]))

  const seedParts = [
    ['BM-PEU-014', 'Filtre à huile', '1109.AY', 'Peugeot / Citroën', 'Filtration', 6800, 12500, 24, 6, 'A-03'],
    ['BM-REN-027', 'Plaquettes de frein avant', '410607115R', 'Renault Clio IV', 'Freinage', 42000, 68000, 4, 5, 'B-12'],
    ['BM-CIT-008', 'Courroie accessoires', '5750.YH', 'Citroën C3', 'Moteur', 22000, 39500, 9, 3, 'C-04'],
    ['BM-REN-041', 'Rotule de direction', '485202710R', 'Renault Symbol', 'Direction', 19000, 32000, 2, 4, 'D-02'],
    ['BM-PEU-033', 'Balai essuie-glace', '6423.91', 'Peugeot 208', 'Carrosserie', 12000, 22500, 16, 5, 'E-07']
  ] as const

  const partStmt = db.prepare(`
    INSERT INTO parts(
      reference, designation, oem_reference, vehicle_compatibility, category_id,
      purchase_price_millimes, sale_price_millimes, quantity, low_stock_threshold, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const movementStmt = db.prepare(`
    INSERT INTO stock_movements(
      part_id, movement_type, quantity_delta, quantity_before, quantity_after, note
    ) VALUES (?, 'INITIAL', ?, 0, ?, 'Development seed')
  `)

  db.exec('BEGIN IMMEDIATE;')
  try {
    for (const part of seedParts) {
      const result = partStmt.run(
        part[0], part[1], part[2], part[3], categoryId.get(part[4]) ?? null,
        part[5], part[6], part[7], part[8], part[9]
      )
      movementStmt.run(Number(result.lastInsertRowid), part[7], part[7])
    }
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}
