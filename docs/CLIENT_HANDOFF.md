# Client handoff

Recommended USB layout:

```text
BEN MAHMOUD STOCK/
├── Ben-Mahmoud-Stock-Portable.exe
├── LIRE-MOI.txt
└── SAUVEGARDES/
    └── README.txt
```

The portable EXE is the application. The active SQLite database is kept in the Windows application-data location on the shop PC, not next to the EXE. This keeps normal EXE updates independent from business data.

Before final handoff, confirm the exact fiscal identity, HT/TTC convention, TVA rules, invoice numbering and whether the shop needs a legally formatted avoir workflow. The current cancellation feature is an internal immutable cancellation with stock reversal, not a claim of fiscal credit-note compliance.

The Windows CI package is smoke-tested by launching the packaged EXE with `--smoke-test`, which initializes SQLite/migrations and exits. Physical printer and client-PC testing still must be performed locally.
