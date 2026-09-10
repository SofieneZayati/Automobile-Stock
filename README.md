# Ben Mahmoud Stock

Professional offline Windows desktop application for **Etablissement Ben Mahmoud — Équipement Automobiles**.

## Main features

- Parts and stock management
- Suppliers and clients
- Stock movement history
- Low-stock alerts and stock value indicators
- Invoice drafts
- Negotiated per-item selling prices
- Whole-invoice commercial adjustment
- Finalized invoice history and reprint
- PDF export and A4 printing
- Internal invoice cancellation with stock restoration
- Local audit journal
- CSV stock export
- SQLite backup and restore
- French-first interface with English and Arabic options

## Business identity

Default establishment information:

- Etablissement Ben Mahmoud
- Équipement Automobiles
- مؤسسة بن محمود — تجهيز السيارات
- 31, Rue Chedly Kallala, 1002 Tunis
- Tél. 71 801 813 / 29 276 853

Fiscal values such as the matricule fiscal, TVA and invoice numbering remain editable from **Paramètres**.

## Data

The application is offline-first and uses SQLite.

The database is **installed automatically on first launch** from the supplied clean
`Ben-Mahmoud-Stock-Clean.sqlite3` database embedded in the application. There is
no database file that the client has to copy manually, and an existing shop
database is never overwritten by an application update.

A fresh installation contains a small, editable starter list:

- the application schema;
- Ben Mahmoud establishment defaults;
- 16 common parts in 8 categories;
- 5 supplier brands;
- 4 starting customer records;
- opening stock movements for the supplied quantities;
- no sample invoices or drafts.

The starter references, prices and quantities must be checked against the real
shop stock before the first sale. Business data is then maintained through the
application itself.

For initial setup, the recommended order is:

1. Configure establishment/fiscal settings.
2. Add suppliers.
3. Add the current parts catalog with real opening quantities and prices.
4. Add regular clients if the shop wants to save them.
5. Create a backup once the initial catalog is complete.

The active database lives in the operating system's Electron application-data
folder rather than inside the delivery folder. Replacing the application folder
during a normal update therefore does not replace the shop database.

## Stock data for each part

A part can store:

- internal reference;
- designation;
- OEM reference;
- vehicle compatibility;
- category;
- supplier;
- purchase price;
- selling price;
- current quantity;
- low-stock threshold;
- shelf/location;
- notes.

All monetary values are handled internally in integer millimes.

## Invoicing

Finalization is transactional:

- live stock is checked;
- invoice numbering is assigned;
- product/customer/business information is snapshotted;
- stock is reduced;
- stock movements are recorded;
- the finalized invoice becomes historical and immutable.

The invoice editor supports negotiated unit prices and whole-invoice commercial adjustments before finalization.

It also records the customer phone number. On finalization, a manually entered
customer is linked to an existing customer when the normalized name and phone
both match. Otherwise a new customer record is created automatically. The
default walk-in customer is never added to the customer list.

## Backups

**Paramètres > Sauvegarde des données** can:

- create an integrity-checked SQLite backup;
- restore a verified backup;
- keep a safety copy before restoring.

Backups can be saved to a USB drive or another external disk.

## Development

Requirements:

- Node.js 22.12 or newer
- Node.js 24 LTS recommended

Install and run:

```bash
npm install
npm run dev
```

Typecheck and build:

```bash
npm run typecheck
npm run build
```

Build the Windows portable application:

```bash
npm run dist:portable
```

Run the automated database/invoice integration test and prepare the final client
folder:

```bash
npm run verify
npm run dist:client
```

Output:

```text
release/Ben-Mahmoud-Stock-Portable-0.2.0.exe
```

## Client delivery

The Windows workflow prepares one fast-launch client folder. Its Electron support
files are hidden on Windows so the shop owner sees only the launcher and guides:

```text
BEN MAHMOUD STOCK - RAPIDE/
├── OUVRIR BEN MAHMOUD STOCK.exe
├── LIRE-MOI.txt
├── FONCTIONS DE L'APPLICATION.txt
├── VERSION.txt
└── SAUVEGARDES/
    └── README.txt
```

The ready-to-copy folder is generated under
`delivery/BEN MAHMOUD STOCK - RAPIDE`. Copy
the complete folder to the shop PC; do not move the EXE by itself. Unlike the
single-file portable build, this edition does not extract Electron on every
launch, so normal startup is much faster. The database is initialized
automatically on the shop PC.

## Technology

- Electron
- React
- TypeScript
- Vite / electron-vite
- Node built-in SQLite
- electron-builder

Core business logic remains in the Electron main process. The renderer accesses data through a typed preload/IPC boundary with context isolation enabled.
