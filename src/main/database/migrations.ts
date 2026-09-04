export type Migration = {
  version: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_business_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        tax_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS parts (
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

      CREATE INDEX IF NOT EXISTS idx_parts_designation ON parts(designation);
      CREATE INDEX IF NOT EXISTS idx_parts_oem_reference ON parts(oem_reference);
      CREATE INDEX IF NOT EXISTS idx_parts_vehicle ON parts(vehicle_compatibility);
      CREATE INDEX IF NOT EXISTS idx_parts_active_quantity ON parts(is_active, quantity);

      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL CHECK (
          movement_type IN ('INITIAL','PURCHASE','SALE','CORRECTION','RETURN','CANCELLATION','OTHER')
        ),
        quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
        quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
        quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
        invoice_id INTEGER,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_stock_movements_part_created
        ON stock_movements(part_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALIZED','CANCELLED')),
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL DEFAULT 'Client comptoir',
        customer_address TEXT,
        customer_tax_id TEXT,
        subtotal_ht_millimes INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_ht_millimes >= 0),
        discount_millimes INTEGER NOT NULL DEFAULT 0 CHECK (discount_millimes >= 0),
        tax_millimes INTEGER NOT NULL DEFAULT 0 CHECK (tax_millimes >= 0),
        total_ttc_millimes INTEGER NOT NULL DEFAULT 0 CHECK (total_ttc_millimes >= 0),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        finalized_at TEXT,
        cancelled_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_status_finalized
        ON invoices(status, finalized_at DESC);

      CREATE TABLE IF NOT EXISTS invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
        reference_snapshot TEXT NOT NULL,
        designation_snapshot TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_ht_millimes INTEGER NOT NULL CHECK (unit_price_ht_millimes >= 0),
        discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
        discount_millimes INTEGER NOT NULL DEFAULT 0 CHECK (discount_millimes >= 0),
        tax_percent REAL NOT NULL DEFAULT 0 CHECK (tax_percent >= 0 AND tax_percent <= 100),
        line_ht_millimes INTEGER NOT NULL CHECK (line_ht_millimes >= 0),
        tax_millimes INTEGER NOT NULL CHECK (tax_millimes >= 0),
        line_ttc_millimes INTEGER NOT NULL CHECK (line_ttc_millimes >= 0)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        action TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },
  {
    version: 2,
    name: 'invoice_stock_fk',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
    `
  }
]
