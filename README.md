# Automobile Stock — Etablissement Ben Mahmoud

Desktop stock and invoicing application for **Etablissement Ben Mahmoud — Equipement Automobiles** in Tunis.

> Primary language: French. Optional interface languages: English and Arabic (RTL).

## Product goal

Build a reliable **offline-first Windows desktop application** that can be copied/delivered on a flash drive and opened with minimal setup. The daily workflow must be fast for a parts shop:

1. Find a part immediately.
2. See real stock and selling price.
3. Add/replenish stock without confusion.
4. Create a customer invoice in a few clicks.
5. Print a clean professional A4 invoice or save it as PDF.
6. Keep history and be able to reprint invoices.
7. Back up and restore the local database safely.

## Business identity

- **Etablissement Ben Mahmoud**
- **Equipement Automobiles**
- **مؤسسة بن محمود — تجهيز السيارات**
- 31, Rue Chedly Kallala, 1002 Tunis
- Tél: 71 801 813 / 29 276 853

The visual direction is inspired by the existing business card: **deep automotive blue, white / warm neutral surfaces, precise typography, restrained borders, and a professional parts-counter feel**.

## Technology decision

### Desktop shell
**Electron + React + TypeScript**

Why:
- dependable one-click Windows desktop delivery;
- can be packaged as a portable Windows executable;
- printing/PDF support is mature;
- no internet is required for normal work;
- future maintenance remains straightforward.

### Data
**SQLite**, stored locally on the shop computer.

The UI never accesses the database directly. Electron main-process services own file/database/printing operations and expose a small typed IPC API to the renderer.

### UI
- React
- TypeScript
- Vite
- CSS design tokens (no heavy UI framework initially)
- Lucide icons
- i18n: French / English / Arabic with RTL support

## Core modules

### 1. Tableau de bord
- stock summary;
- low-stock alerts;
- today's invoices / sales;
- quick actions: Nouvelle facture, Ajouter une pièce, Entrée de stock;
- recent invoices.

### 2. Pièces / Stock
Each part can contain:
- internal reference / SKU;
- designation;
- OEM/reference numbers;
- compatible brand/model;
- category;
- supplier;
- purchase price;
- selling price;
- quantity;
- low-stock threshold;
- shelf/location;
- notes;
- active/inactive state.

Important operations:
- search by reference, designation, OEM number, vehicle or category;
- add/edit/archive;
- stock entry and stock correction;
- movement history;
- low-stock filter;
- CSV export is implemented; bulk CSV import can be added later if the client needs it.

### 3. Clients
- name/company;
- phone;
- address;
- optional tax/company identifiers;
- invoice history.

A walk-in customer must also be supported without forcing client creation.

### 4. Facturation
Invoice creation is a first-class workflow, not an afterthought.

The editor should:
- search/add products without leaving the invoice;
- show current stock;
- support quantity, unit price, discount, VAT/tax configuration;
- calculate HT / remise / TVA / TTC clearly;
- allow custom invoice lines when appropriate;
- prevent accidental negative stock unless explicitly overridden;
- reserve the invoice number only when finalizing;
- use an immutable finalized snapshot so old invoices do not change when product prices change;
- save drafts;
- duplicate/reprint invoices;
- print or export PDF.

### 5. Paramètres
- company identity and invoice footer;
- invoice numbering;
- currency (TND);
- tax defaults;
- language;
- printer preferences;
- database backup/restore;
- theme later if useful.

## Invoice quality requirements

The printed invoice is a primary deliverable.

### A4 hierarchy
1. company identity at top-left;
2. clear **FACTURE** title and invoice number/date at top-right;
3. customer block;
4. high-legibility line-item table;
5. totals block aligned right;
6. payment/notes and footer details;
7. no UI controls or unnecessary colors in print.

### Rules
- stable printable margins;
- black/gray text with restrained brand-blue accents;
- long descriptions wrap correctly;
- totals never split awkwardly across pages;
- repeated table header on additional pages;
- number/currency formatting suitable for Tunisia;
- French invoice by default; English/Arabic selectable;
- clean print preview before finalization/reprint.

## UX principles

- Desktop-first (1366×768 and above), keyboard-friendly.
- French labels are concise and shop-oriented.
- Search is always prominent.
- Destructive actions require confirmation.
- Important stock changes leave an audit trail.
- Forms use clear units and examples.
- Empty states explain the next action.
- Arabic mode switches layout direction to RTL, not only translated text.
- Critical flows must remain usable without internet.

## Initial data model

- `parts`
- `categories`
- `suppliers`
- `clients`
- `stock_movements`
- `invoices`
- `invoice_lines`
- `app_settings`
- `audit_log`

Invoice lines keep a snapshot of the designation/reference/unit price/tax/discount at the time of finalization.

## Delivery phases

### Phase 0 — Foundation
- [x] Product/UX direction
- [x] Architecture decision
- [x] Electron + React + TypeScript shell
- [x] design system
- [x] localization foundation
- [x] local development/build scripts

### Phase 1 — Functional prototype
- [x] dashboard
- [x] parts list + part form
- [x] stock movements
- [x] invoice editor prototype
- [x] invoice print preview

### Phase 2 — Real local data
- [x] SQLite schema + migrations
- [x] core parts/client CRUD services
- [x] invoice finalization transaction
- [x] stock decrement / movement ledger
- [x] business/fiscal settings persistence

### Phase 3 — Production workflow
- [x] suppliers
- [x] clients
- [x] search/filter polish
- [x] invoice history/reprint
- [x] backups/restores
- [x] validation and error states
- [x] audit log

### Phase 4 — Desktop delivery
- [x] Windows packaging
- [x] portable build for flash-drive delivery
- [x] app icon / company branding
- [ ] printer testing
- [x] seeded production defaults
- [x] installation/use guide

## Repository rules

- `main` stays runnable.
- Keep business logic outside React components.
- No remote service is required for core workflows.
- Monetary calculations use integer millimes or a decimal-safe representation — never binary floating-point business logic.
- Finalized invoices are treated as historical documents.
- Database migrations are versioned.
- Never silently delete stock history or finalized invoice records.

## First milestone

A polished desktop shell with:
- branded navigation;
- French-first dashboard;
- stock table;
- invoice editor;
- print-ready invoice preview;
- language switch foundation.

That milestone should make the visual and workflow direction obvious before database implementation is locked in.


## Current implementation status — September 2026

The application has moved beyond static UI mockups:

- SQLite is now the real source of truth for parts, quantities, stock movements and finalized invoices.
- Development mode seeds a small demonstration catalog; packaged production builds start without fake stock.
- Adding, editing, archiving/restoring a part and recording stock entry/correction are connected to SQLite. Each part can be associated with a saved supplier.
- Invoice product search reads live stock; saved clients can be selected and their name/address/tax ID are snapshotted onto the invoice.
- Finalizing an invoice is transactional: stock is checked, a configurable sequential number is assigned, immutable line/business snapshots are written and SALE movements decrement stock together.
- Invoice drafts can be saved, reopened, updated, deleted, and consumed safely when finalizing. Finalized invoices have searchable history/reprint, per-client history, negotiated per-item prices and whole-invoice discounts. Finalized invoices can be cancelled internally with a required reason while restoring stock through cancellation movements.
- Dashboard totals and low-stock warnings come from local data. Per-part stock movement history is viewable from the stock table, including linked invoice numbers for sales. Stock reporting includes active references, units, low/out counts, purchase-value, theoretical sale-value, category/supplier/stock-state filters and Excel-friendly CSV export.
- Editable establishment identity, address, phones, matricule fiscal, TVA default, invoice prefix/digits and default customer are persisted in SQLite. Validation prevents invalid fiscal/numbering values. Manual backups are integrity-checked immediately after creation; restore keeps an automatic pre-restore safety copy and retains the 10 newest safety copies.
- Language selection persists locally; French remains the default and Arabic switches document direction to RTL. Ctrl+K performs global part/reference/OEM search and F2 opens the invoice product picker.
- Windows CI builds the portable EXE with a Ben Mahmoud icon, launches the packaged application in database/migration smoke-test mode, and prepares a client delivery artifact with the EXE, quick guide and backup folder.
- GitHub CI verifies install, TypeScript and Electron/Vite build on every push. The app enforces a single running instance and checks SQLite integrity on startup before opening the shop UI.

### Still intentionally open before client delivery

- Confirm fiscal/legal invoice fields with the client (matricule fiscal, HT/TTC convention, TVA rules and invoice numbering).
- Confirm the exact client fiscal values before final delivery; the app now makes them editable and snapshots them on finalized invoices.
- Internal cancellation with stock reversal is implemented. A legally formatted fiscal avoir remains intentionally open until the client's accounting requirements are confirmed.
- Multi-page print CSS repeats table headers, keeps rows/totals together where possible and wraps long descriptions. Settings includes a built-in 36-line A4 printer stress test that does not touch stock or invoices. Physical printer validation can still be done later if desired.
- Test backup/restore with production-like data.
- Run and validate the Windows portable artifact on the client's actual Windows machine and printer.


## Delivery/testing documents

- `docs/LIRE-MOI.txt` — simple client quick-start guide included in the delivery package.
- `docs/CLIENT_HANDOFF.md` — technical handoff and USB-delivery notes.
- `docs/ACCEPTANCE_TEST.md` — end-to-end acceptance checklist for stock, invoices, cancellation, backup/restore, printing and portable delivery.


## Client-ready handoff

The Windows delivery workflow now produces two deliberately separate artifacts/folders:

### BEN MAHMOUD STOCK - CLIENT

This is the folder intended for the shop:

- `Ben-Mahmoud-Stock-Portable.exe`
- `LIRE-MOI.txt`
- `SAUVEGARDES/README.txt`

The packaged application starts with no fake stock in production.

### PREPARATION - A RETIRER AVANT LIVRAISON

This folder is for project preparation and must normally be removed before handing the USB to the client. It contains:

- `BASE-CLIENT-VIDE.sqlite3` — clean current-schema database with Ben Mahmoud defaults and no fake business data.
- `BASE-DEMO-A-REMPLACER.sqlite3` — example database with clearly marked sample suppliers, clients, parts and one sample draft.
- `CONFIGURATION-REELLE-A-COMPLETER.txt` — list of client-specific values that still need to be confirmed.
- sample CSV files showing the expected information for parts, clients and suppliers.
- `A-REMPLACER-AVANT-CLIENT.txt` — explicit instructions on what is placeholder data and what should be removed/replaced.

The application can inspect either starter database through **Paramètres > Restaurer une sauvegarde**. The demo database should be used only on a preparation PC because restoring a database replaces the currently open business data.
