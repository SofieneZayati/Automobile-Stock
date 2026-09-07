import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'release', 'preparation')
mkdirSync(outputDir, { recursive: true })

const cleanPath = join(outputDir, 'BASE-CLIENT-VIDE.sqlite3')
const demoPath = join(outputDir, 'BASE-DEMO-A-REMPLACER.sqlite3')

createDatabase(cleanPath, false)
createDatabase(demoPath, true)

console.log('Starter databases created:')
console.log(cleanPath)
console.log(demoPath)

function createDatabase(path, withDemoData) {
  rmSync(path, { force: true })
  const db = new DatabaseSync(path)

  try {
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA journal_mode = DELETE;')
    db.exec('PRAGMA synchronous = FULL;')
    db.exec(schemaSql)

    for (const migration of [
      [1, 'initial_business_schema'],
      [2, 'invoice_stock_fk'],
      [3, 'invoice_global_discount'],
      [4, 'invoice_business_snapshot'],
      [5, 'invoice_draft_updated_at'],
      [6, 'invoice_cancellation_reason']
    ]) {
      db.prepare(
        'INSERT INTO schema_migrations(version, name) VALUES (?, ?)'
      ).run(...migration)
    }

    const business = {
      companyName: 'Etablissement Ben Mahmoud',
      activity: 'Équipement Automobiles',
      companyNameAr: 'مؤسسة بن محمود',
      activityAr: 'تجهيز السيارات',
      address: '31, Rue Chedly Kallala, 1002 Tunis',
      phone1: '71 801 813',
      phone2: '29 276 853',
      taxId: '',
      defaultTaxPercent: 19,
      invoicePrefix: 'F',
      invoiceDigits: 4,
      defaultCustomerName: 'Client comptoir'
    }

    db.prepare(
      "INSERT INTO app_settings(key, value_json) VALUES ('business', ?)"
    ).run(JSON.stringify(business))

    if (withDemoData) seedDemo(db, business)

    const row = db.prepare('PRAGMA quick_check;').get()
    const integrity = row ? Object.values(row)[0] : 'unknown'
    if (integrity !== 'ok') {
      throw new Error(`Database quick_check failed: ${integrity}`)
    }
  } finally {
    db.close()
  }
}

function seedDemo(db, business) {
  const categories = [
    'Filtration',
    'Freinage',
    'Moteur',
    'Direction',
    'Électricité',
    'Carrosserie'
  ]

  const categoryInsert = db.prepare(
    'INSERT INTO categories(name) VALUES (?)'
  )
  for (const category of categories) categoryInsert.run(category)

  const categoryRows = db.prepare(
    'SELECT id, name FROM categories'
  ).all()
  const categoryIds = new Map(
    categoryRows.map((row) => [row.name, row.id])
  )

  const suppliers = [
    [
      'FOURNISSEUR EXEMPLE 1',
      '71 000 001',
      'exemple1@fournisseur.tn',
      'Tunis',
      'A REMPLACER par le vrai fournisseur'
    ],
    [
      'FOURNISSEUR EXEMPLE 2',
      '71 000 002',
      'exemple2@fournisseur.tn',
      'Ben Arous',
      'A REMPLACER'
    ],
    [
      'FOURNISSEUR EXEMPLE 3',
      '71 000 003',
      'exemple3@fournisseur.tn',
      'Ariana',
      'A REMPLACER'
    ]
  ]

  const supplierInsert = db.prepare(`
    INSERT INTO suppliers(name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const supplier of suppliers) supplierInsert.run(...supplier)

  const supplierRows = db.prepare(
    'SELECT id, name FROM suppliers'
  ).all()
  const supplierIds = new Map(
    supplierRows.map((row) => [row.name, row.id])
  )

  const clients = [
    [
      'CLIENT EXEMPLE COMPTANT',
      '20 000 001',
      'Tunis',
      '',
      'A REMPLACER / SUPPRIMER avant livraison'
    ],
    [
      'GARAGE EXEMPLE SARL',
      '20 000 002',
      'Ben Arous',
      'MF-EXEMPLE-001',
      'A REMPLACER'
    ],
    [
      'CLIENT EXEMPLE 3',
      '20 000 003',
      'Ariana',
      '',
      'A REMPLACER'
    ]
  ]

  const clientInsert = db.prepare(`
    INSERT INTO clients(name, phone, address, tax_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const client of clients) clientInsert.run(...client)

  const parts = [
    ['EX-REN-001', 'Filtre à huile', '1109.AY', 'Renault / Peugeot', 'Filtration', 'FOURNISSEUR EXEMPLE 1', 6800, 12500, 24, 6, 'A-01'],
    ['EX-REN-002', 'Plaquettes de frein avant', '410607115R', 'Renault Clio IV', 'Freinage', 'FOURNISSEUR EXEMPLE 2', 42000, 68000, 4, 5, 'B-02'],
    ['EX-CIT-003', 'Courroie accessoires', '5750.YH', 'Citroën C3', 'Moteur', 'FOURNISSEUR EXEMPLE 1', 22000, 39500, 9, 3, 'C-01'],
    ['EX-REN-004', 'Rotule de direction', '485202710R', 'Renault Symbol', 'Direction', 'FOURNISSEUR EXEMPLE 3', 19000, 32000, 2, 4, 'D-03'],
    ['EX-PEU-005', 'Balai essuie-glace', '6423.91', 'Peugeot 208', 'Carrosserie', 'FOURNISSEUR EXEMPLE 2', 12000, 22500, 16, 5, 'E-04'],
    ['EX-REN-006', 'Filtre à air', '165469466R', 'Renault Clio IV', 'Filtration', 'FOURNISSEUR EXEMPLE 1', 18000, 29500, 11, 4, 'A-02'],
    ['EX-PEU-007', "Bougie d'allumage", '5960.F3', 'Peugeot / Citroën', 'Électricité', 'FOURNISSEUR EXEMPLE 3', 9000, 15000, 30, 8, 'F-01'],
    ['EX-REN-008', 'Disque de frein avant', '402069518R', 'Renault Symbol', 'Freinage', 'FOURNISSEUR EXEMPLE 2', 55000, 89000, 6, 2, 'B-04'],
    ['EX-CIT-009', 'Pompe à eau', '1201.K2', 'Citroën C3', 'Moteur', 'FOURNISSEUR EXEMPLE 1', 48000, 76000, 3, 2, 'C-06'],
    ['EX-PEU-010', 'Ampoule H7', '6216.A6', 'Peugeot 208', 'Électricité', 'FOURNISSEUR EXEMPLE 3', 6500, 12000, 20, 6, 'F-03'],
    ['EX-REN-011', 'Biellette de direction', '485210001R', 'Renault Clio', 'Direction', 'FOURNISSEUR EXEMPLE 2', 24000, 41000, 0, 3, 'D-05'],
    ['EX-CIT-012', 'Filtre habitacle', '6447.XF', 'Citroën / Peugeot', 'Filtration', 'FOURNISSEUR EXEMPLE 1', 11000, 19500, 8, 3, 'A-05']
  ]

  const partInsert = db.prepare(`
    INSERT INTO parts(
      reference, designation, oem_reference, vehicle_compatibility,
      category_id, supplier_id, purchase_price_millimes,
      sale_price_millimes, quantity, low_stock_threshold, location, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const movementInsert = db.prepare(`
    INSERT INTO stock_movements(
      part_id, movement_type, quantity_delta,
      quantity_before, quantity_after, note
    ) VALUES (?, 'INITIAL', ?, 0, ?, 'Stock démo à remplacer')
  `)

  for (const part of parts) {
    const result = partInsert.run(
      part[0],
      part[1],
      part[2],
      part[3],
      categoryIds.get(part[4]) ?? null,
      supplierIds.get(part[5]) ?? null,
      part[6],
      part[7],
      part[8],
      part[9],
      part[10],
      'DONNÉE DÉMO À REMPLACER'
    )

    if (part[8] > 0) {
      movementInsert.run(
        Number(result.lastInsertRowid),
        part[8],
        part[8]
      )
    }
  }

  const demoClient = db.prepare(
    "SELECT id FROM clients WHERE name = 'GARAGE EXEMPLE SARL'"
  ).get()

  const draftResult = db.prepare(`
    INSERT INTO invoices(
      status, client_id, customer_name, customer_address, customer_tax_id,
      subtotal_ht_millimes, discount_millimes,
      global_discount_ttc_millimes, tax_millimes, total_ttc_millimes,
      notes, business_snapshot_json, updated_at
    ) VALUES (
      'DRAFT', ?, 'GARAGE EXEMPLE SARL', 'Ben Arous', 'MF-EXEMPLE-001',
      43500, 1700, 0, 7942, 49742,
      'BROUILLON EXEMPLE À SUPPRIMER', ?, datetime('now')
    )
  `).run(demoClient.id, JSON.stringify(business))

  const draftId = Number(draftResult.lastInsertRowid)
  const invoiceLineInsert = db.prepare(`
    INSERT INTO invoice_lines(
      invoice_id, part_id, reference_snapshot, designation_snapshot,
      quantity, unit_price_ht_millimes, discount_percent,
      discount_millimes, tax_percent, line_ht_millimes,
      tax_millimes, line_ttc_millimes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const demoLines = [
    ['EX-REN-001', 'Filtre à huile', 2, 12500, 1000, 24000],
    ['EX-CIT-012', 'Filtre habitacle', 1, 19500, 700, 18800]
  ]

  for (const line of demoLines) {
    const part = db.prepare(
      'SELECT id FROM parts WHERE reference = ?'
    ).get(line[0])
    const tax = Math.round(line[5] * 0.19)
    invoiceLineInsert.run(
      draftId,
      part.id,
      line[0],
      line[1],
      line[2],
      line[3],
      (line[4] / (line[3] * line[2])) * 100,
      line[4],
      19,
      line[5],
      tax,
      line[5] + tax
    )
  }

  db.prepare(`
    INSERT INTO audit_log(
      entity_type, entity_id, action, details_json
    ) VALUES ('settings', NULL, 'DEMO_DATABASE', ?)
  `).run(JSON.stringify({
    warning:
      'BASE DEMO A REMPLACER - ne pas utiliser comme base client finale'
  }))
}

const schemaSql = `
  CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL COLLATE NOCASE UNIQUE,
    designation TEXT NOT NULL,
    oem_reference TEXT,
    vehicle_compatibility TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_price_millimes INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price_millimes >= 0),
    sale_price_millimes INTEGER NOT NULL DEFAULT 0 CHECK (sale_price_millimes >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
    location TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_parts_designation ON parts(designation);
  CREATE INDEX idx_parts_oem_reference ON parts(oem_reference);
  CREATE INDEX idx_parts_vehicle ON parts(vehicle_compatibility);
  CREATE INDEX idx_parts_active_quantity ON parts(is_active, quantity);

  CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (
      movement_type IN (
        'INITIAL','PURCHASE','SALE','CORRECTION',
        'RETURN','CANCELLATION','OTHER'
      )
    ),
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
    quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
    quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
    invoice_id INTEGER,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_stock_movements_part_created
    ON stock_movements(part_id, created_at DESC);

  CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'DRAFT'
      CHECK (status IN ('DRAFT','FINALIZED','CANCELLED')),
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT 'Client comptoir',
    customer_address TEXT,
    customer_tax_id TEXT,
    subtotal_ht_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (subtotal_ht_millimes >= 0),
    discount_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (discount_millimes >= 0),
    tax_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (tax_millimes >= 0),
    total_ttc_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (total_ttc_millimes >= 0),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finalized_at TEXT,
    cancelled_at TEXT,
    global_discount_ttc_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (global_discount_ttc_millimes >= 0),
    business_snapshot_json TEXT,
    updated_at TEXT,
    cancellation_reason TEXT
  );

  CREATE INDEX idx_invoices_status_finalized
    ON invoices(status, finalized_at DESC);

  CREATE INDEX idx_invoices_status_updated
    ON invoices(status, updated_at DESC);

  CREATE TABLE invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
    reference_snapshot TEXT NOT NULL,
    designation_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_ht_millimes INTEGER NOT NULL
      CHECK (unit_price_ht_millimes >= 0),
    discount_percent REAL NOT NULL DEFAULT 0
      CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_millimes INTEGER NOT NULL DEFAULT 0
      CHECK (discount_millimes >= 0),
    tax_percent REAL NOT NULL DEFAULT 0
      CHECK (tax_percent >= 0 AND tax_percent <= 100),
    line_ht_millimes INTEGER NOT NULL CHECK (line_ht_millimes >= 0),
    tax_millimes INTEGER NOT NULL CHECK (tax_millimes >= 0),
    line_ttc_millimes INTEGER NOT NULL CHECK (line_ttc_millimes >= 0)
  );

  CREATE INDEX idx_invoice_lines_invoice
    ON invoice_lines(invoice_id);

  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_audit_entity
    ON audit_log(entity_type, entity_id, created_at DESC);
`
