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
- CSV import/export later.

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
- [ ] Electron + React + TypeScript shell
- [ ] design system
- [ ] localization foundation
- [ ] local development/build scripts

### Phase 1 — Functional prototype
- [ ] dashboard
- [ ] parts list + part form
- [ ] stock movements
- [ ] invoice editor prototype
- [ ] invoice print preview

### Phase 2 — Real local data
- [ ] SQLite schema + migrations
- [ ] CRUD services
- [ ] invoice finalization transaction
- [ ] stock decrement / movement ledger
- [ ] settings persistence

### Phase 3 — Production workflow
- [ ] clients and suppliers
- [ ] search/filter polish
- [ ] invoice history/reprint
- [ ] backups/restores
- [ ] validation and error states
- [ ] audit log

### Phase 4 — Desktop delivery
- [ ] Windows packaging
- [ ] portable build for flash-drive delivery
- [ ] app icon / company branding
- [ ] printer testing
- [ ] seeded production defaults
- [ ] installation/use guide

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
