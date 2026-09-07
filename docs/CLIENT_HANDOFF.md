# Client handoff

The generated Windows handoff is intentionally split into two folders/artifacts.

## 1. BEN MAHMOUD STOCK - CLIENT

This is the folder to copy to the shop or final flash drive:

```text
BEN MAHMOUD STOCK - CLIENT/
├── Ben-Mahmoud-Stock-Portable.exe
├── LIRE-MOI.txt
└── SAUVEGARDES/
    └── README.txt
```

The EXE is the application. The active SQLite database is stored in the Windows application-data location on the shop PC, not next to the EXE. Replacing the EXE during a normal update therefore does not replace the business database.

The packaged production application starts without fake stock.

## 2. PREPARATION - A RETIRER AVANT LIVRAISON

This folder is for project preparation and should normally NOT be copied to the client's flash drive:

```text
PREPARATION - A RETIRER AVANT LIVRAISON/
├── BASE-CLIENT-VIDE.sqlite3
├── BASE-DEMO-A-REMPLACER.sqlite3
├── A-REMPLACER-AVANT-CLIENT.txt
├── CONFIGURATION-REELLE-A-COMPLETER.txt
├── PIECES-EXEMPLES.csv
├── CLIENTS-EXEMPLES.csv
└── FOURNISSEURS-EXEMPLES.csv
```

### BASE-CLIENT-VIDE.sqlite3

Clean schema-compatible starter database:
- Ben Mahmoud identity/address/phones prefilled;
- matricule fiscal blank;
- TVA 19%, prefix F, four invoice digits as editable starting values;
- no fake stock;
- no fake clients or suppliers;
- no invoices or movements.

### BASE-DEMO-A-REMPLACER.sqlite3

Training/example database only:
- clearly fake/example suppliers;
- clearly fake/example clients;
- 12 example stock references;
- stock quantities and locations;
- one sample draft;
- no real finalized sales history.

It can be opened through **Paramètres > Restaurer une sauvegarde** to understand the data structure. Restoring replaces the current open database, so the demo database is for a preparation PC only.

## What to collect from the client

Before treating the setup as final, fill in:
- exact matricule fiscal;
- exact HT/TTC convention;
- confirmed TVA rules;
- desired invoice prefix/numbering;
- actual suppliers;
- actual part references/OEM/compatibility;
- purchase and sale prices;
- real opening stock quantities;
- shelf/location codes;
- clients the shop actually wants to save;
- whether a fiscal avoir workflow is required.

The current invoice cancellation feature is an internal immutable cancellation with stock reversal, not a claim of fiscal credit-note compliance.

## Delivery rule

When the real data are ready, hand the client only **BEN MAHMOUD STOCK - CLIENT**. Keep **PREPARATION - A RETIRER AVANT LIVRAISON** for yourself as a reference/template pack.
