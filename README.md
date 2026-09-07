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

The database is **created automatically on first launch**. There is no database file that the client has to copy manually.

A fresh installation contains:

- the application schema;
- Ben Mahmoud establishment defaults;
- no fake parts;
- no fake suppliers;
- no fake clients;
- no fake invoices;
- no fake stock movements.

Business data is then entered through the application itself.

For initial setup, the recommended order is:

1. Configure establishment/fiscal settings.
2. Add suppliers.
3. Add the current parts catalog with real opening quantities and prices.
4. Add regular clients if the shop wants to save them.
5. Create a backup once the initial catalog is complete.

The active database lives in the operating system's Electron application-data folder rather than next to the portable EXE. Replacing the EXE during a normal update therefore does not replace the shop database.

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

Output:

```text
release/Ben-Mahmoud-Stock-Portable-0.1.0.exe
```

## Client delivery

The Windows workflow prepares one clean client folder:

```text
BEN MAHMOUD STOCK/
├── Ben-Mahmoud-Stock-Portable.exe
├── LIRE-MOI.txt
└── SAUVEGARDES/
    └── README.txt
```

The client only needs the portable application. The database is initialized automatically on the shop PC.

## Technology

- Electron
- React
- TypeScript
- Vite / electron-vite
- Node built-in SQLite
- electron-builder

Core business logic remains in the Electron main process. The renderer accesses data through a typed preload/IPC boundary with context isolation enabled.
