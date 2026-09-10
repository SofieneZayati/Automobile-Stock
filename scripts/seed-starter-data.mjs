import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const seedPath = resolve(import.meta.dirname, '..', 'resources', 'initial-database.sqlite3')

if (!existsSync(seedPath)) {
  throw new Error(`Fichier de départ introuvable: ${seedPath}`)
}

const categories = [
  'Filtration',
  'Freinage',
  'Moteur',
  'Direction',
  'Électricité',
  'Carrosserie',
  'Roulements',
  'Embrayage'
]

const suppliers = [
  ['Bosch', 'Freinage, électricité et entretien'],
  ['Valeo', 'Éclairage, essuyage et embrayage'],
  ['MANN-FILTER', 'Filtres moteur et habitacle'],
  ['Gates', 'Courroies et distribution'],
  ['SKF', 'Roulements et transmission']
]

const clients = [
  ['Sofiene Zayati', null, 'Tunis'],
  ['Garage El Menzah', null, 'El Menzah'],
  ['Garage Ben Arous', null, 'Ben Arous'],
  ['Garage Ariana', null, 'Ariana']
]

const parts = [
  ['BM-FIL-001', 'Filtre à huile', null, 'Renault / Peugeot', 'Filtration', 'MANN-FILTER', 6800, 12500, 24, 6, 'A-01'],
  ['BM-FIL-002', 'Filtre à air', null, 'Renault Clio IV', 'Filtration', 'MANN-FILTER', 18000, 29500, 11, 4, 'A-02'],
  ['BM-FIL-003', 'Filtre habitacle', null, 'Citroën / Peugeot', 'Filtration', 'MANN-FILTER', 11000, 19500, 8, 3, 'A-03'],
  ['BM-FRE-001', 'Plaquettes de frein avant', null, 'Renault Clio IV', 'Freinage', 'Bosch', 42000, 68000, 4, 5, 'B-01'],
  ['BM-FRE-002', 'Disque de frein avant', null, 'Renault Symbol', 'Freinage', 'Bosch', 55000, 89000, 6, 2, 'B-02'],
  ['BM-FRE-003', 'Liquide de frein DOT 4', null, 'Universel', 'Freinage', 'Bosch', 12000, 20000, 12, 4, 'B-03'],
  ['BM-MOT-001', 'Courroie accessoires', null, 'Citroën C3', 'Moteur', 'Gates', 22000, 39500, 9, 3, 'C-01'],
  ['BM-MOT-002', 'Pompe à eau', null, 'Citroën C3', 'Moteur', 'Gates', 48000, 76000, 3, 2, 'C-02'],
  ['BM-MOT-003', 'Kit courroie de distribution', null, 'Renault Clio', 'Moteur', 'Gates', 75000, 115000, 3, 2, 'C-03'],
  ['BM-DIR-001', 'Rotule de direction', null, 'Renault Symbol', 'Direction', 'SKF', 19000, 32000, 2, 4, 'D-01'],
  ['BM-DIR-002', 'Biellette de direction', null, 'Renault Clio', 'Direction', 'SKF', 24000, 41000, 0, 3, 'D-02'],
  ['BM-CAR-001', "Balai d'essuie-glace", null, 'Peugeot 208', 'Carrosserie', 'Valeo', 12000, 22500, 16, 5, 'E-01'],
  ['BM-ELE-001', "Bougie d'allumage", null, 'Peugeot / Citroën', 'Électricité', 'Bosch', 9000, 15000, 30, 8, 'F-01'],
  ['BM-ELE-002', 'Ampoule H7', null, 'Peugeot / Renault', 'Électricité', 'Valeo', 6500, 12000, 20, 6, 'F-02'],
  ['BM-ROU-001', 'Roulement de roue avant', null, 'Renault Clio', 'Roulements', 'SKF', 45000, 72000, 5, 2, 'G-01'],
  ['BM-EMB-001', "Kit d'embrayage", null, 'Renault Symbol', 'Embrayage', 'Valeo', 240000, 330000, 2, 1, 'H-01']
]

const db = new DatabaseSync(seedPath)
db.exec('PRAGMA foreign_keys = ON;')
db.exec('BEGIN IMMEDIATE;')

try {
  const hasReturnTables = Boolean(db.prepare(`
    SELECT 1 FROM sqlite_master
    WHERE type = 'table' AND name = 'invoice_returns'
  `).get())
  if (hasReturnTables) {
    db.exec('DELETE FROM invoice_return_lines; DELETE FROM invoice_returns;')
  }

  db.exec(`
    DELETE FROM invoice_lines;
    DELETE FROM stock_movements;
    DELETE FROM invoices;
    DELETE FROM audit_log;
    DELETE FROM parts;
    DELETE FROM categories;
    DELETE FROM suppliers;
    DELETE FROM clients;
    DELETE FROM sqlite_sequence
    WHERE name IN (
      'invoice_lines', 'stock_movements', 'invoices', 'audit_log',
      'parts', 'categories', 'suppliers', 'clients',
      'invoice_returns', 'invoice_return_lines'
    );
  `)

  const insertCategory = db.prepare('INSERT INTO categories(name) VALUES (?)')
  for (const category of categories) insertCategory.run(category)

  const categoryIds = new Map(
    db.prepare('SELECT id, name FROM categories').all().map((row) => [row.name, row.id])
  )

  const insertSupplier = db.prepare(`
    INSERT INTO suppliers(name, notes) VALUES (?, ?)
  `)
  for (const supplier of suppliers) insertSupplier.run(...supplier)

  const supplierIds = new Map(
    db.prepare('SELECT id, name FROM suppliers').all().map((row) => [row.name, row.id])
  )

  const insertClient = db.prepare(`
    INSERT INTO clients(name, phone, address) VALUES (?, ?, ?)
  `)
  for (const client of clients) insertClient.run(...client)

  const insertPart = db.prepare(`
    INSERT INTO parts(
      reference, designation, oem_reference, vehicle_compatibility,
      category_id, supplier_id, purchase_price_millimes,
      sale_price_millimes, quantity, low_stock_threshold, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements(
      part_id, movement_type, quantity_delta, quantity_before, quantity_after, note
    ) VALUES (?, 'INITIAL', ?, 0, ?, 'Stock initial')
  `)

  for (const part of parts) {
    const [
      reference,
      designation,
      oemReference,
      compatibility,
      category,
      supplier,
      purchasePrice,
      salePrice,
      quantity,
      threshold,
      location
    ] = part
    const result = insertPart.run(
      reference,
      designation,
      oemReference,
      compatibility,
      categoryIds.get(category),
      supplierIds.get(supplier),
      purchasePrice,
      salePrice,
      quantity,
      threshold,
      location
    )
    if (quantity > 0) {
      insertMovement.run(Number(result.lastInsertRowid), quantity, quantity)
    }
  }

  db.exec('COMMIT;')
} catch (error) {
  db.exec('ROLLBACK;')
  throw error
}

const counts = Object.fromEntries(
  ['clients', 'suppliers', 'categories', 'parts', 'invoices'].map((table) => [
    table,
    Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
  ])
)
const unwanted = Number(db.prepare(`
  SELECT COUNT(*) AS count
  FROM (
    SELECT name AS value FROM clients
    UNION ALL SELECT name FROM suppliers
    UNION ALL SELECT reference FROM parts
    UNION ALL SELECT designation FROM parts
  )
  WHERE lower(value) LIKE '%exemple%'
     OR lower(value) LIKE '%test%'
     OR lower(value) LIKE '%demo%'
`).get().count)
const integrity = Object.values(db.prepare('PRAGMA quick_check;').get())[0]
db.close()

if (
  counts.clients !== clients.length
  || counts.suppliers !== suppliers.length
  || counts.categories !== categories.length
  || counts.parts !== parts.length
  || counts.invoices !== 0
  || unwanted !== 0
  || integrity !== 'ok'
) {
  throw new Error(`Contrôle des données de départ échoué: ${JSON.stringify({ counts, unwanted, integrity })}`)
}

console.log(`Données de départ prêtes: ${JSON.stringify(counts)}`)
