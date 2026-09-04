# Architecture

## Runtime boundaries

```
React renderer
  │ typed IPC only
  ▼
Electron preload
  │ narrow contextBridge API
  ▼
Electron main
  ├── database service (SQLite)
  ├── invoice service
  ├── stock service
  ├── backup service
  └── print/PDF service
```

The renderer never receives raw filesystem or Node.js access.

## Data principles

1. **Offline first.** Core sales/stock work must never depend on a remote API.
2. **SQLite with migrations.** Database changes are explicit and versioned.
3. **Money is integer millimes.** 12.500 TND is stored as `12500`.
4. **Inventory uses a movement ledger.** The current quantity can be cached, but each material change is traceable.
5. **Finalized invoices are historical snapshots.** A renamed part or changed selling price cannot rewrite an old invoice.
6. **Invoice finalization is transactional.** Number assignment, invoice snapshot, stock movement and totals happen together.
7. **Backups are user-visible.** Automatic local backup plus explicit copy/export to USB is planned.

## Database location

The database file will live in Electron's application-data directory rather than next to the executable. This keeps the portable executable replaceable without risking business data.

A later delivery option may add a clearly labelled **Backup data** folder on the flash disk, but live data should remain on the shop PC unless the client explicitly wants true USB-portable data.

## Security baseline

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- no arbitrary command execution from the renderer
- strict validation at IPC/service boundaries
- no cloud credentials are needed for normal operation

## Future module folders

```
src/main/
  database/
    migrations/
    repositories/
  services/
    invoice/
    stock/
    backup/
    print/
  ipc/
src/renderer/src/
  components/
  pages/
  features/
  lib/
  i18n/
```
