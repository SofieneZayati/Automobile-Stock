# Client acceptance checklist

Use this checklist before handing Ben Mahmoud Stock to the shop.

## First launch
- [ ] Portable EXE starts without Node.js, npm or a terminal.
- [ ] The application opens its local SQLite database.
- [ ] Packaged production build contains no demonstration stock.
- [ ] Closing and reopening preserves data.

## Business settings
- [ ] Company identity, Arabic identity, address and phones save correctly.
- [ ] Matricule fiscal can be entered once confirmed.
- [ ] Default TVA validates between 0 and 100.
- [ ] Invoice prefix accepts only the supported characters.
- [ ] Invoice digit count validates between 3 and 8.
- [ ] Finalized invoice keeps the old business snapshot after settings change.

## Suppliers and clients
- [ ] Create/edit/search a supplier.
- [ ] Invalid supplier email is rejected with a clear message.
- [ ] Associate a supplier with a part.
- [ ] Create/edit/search a client.
- [ ] Select a saved client during invoicing.
- [ ] Client invoice history opens correctly.

## Stock
- [ ] Add a part with prices and initial quantity.
- [ ] Duplicate reference is rejected with a friendly message.
- [ ] Edit metadata without directly changing quantity.
- [ ] PURCHASE, RETURN and CORRECTION movements update stock.
- [ ] Negative stock is rejected.
- [ ] Low/out-of-stock indicators are correct.
- [ ] Category/supplier/stock filters work.
- [ ] Movement history shows before/after values and invoice links.
- [ ] Archive and restore a part.
- [ ] CSV export opens correctly in Excel/LibreOffice.

## Invoice discounts
- [ ] Catalogue price 21,700 DT can be negotiated to 21,000 DT.
- [ ] Catalogue price 21,700 DT can be negotiated to 20,000 DT.
- [ ] A total around 205 DT can be rounded to a final total of 200 DT.
- [ ] Client price above catalogue is rejected.
- [ ] Global discount above total is rejected.

## Drafts
- [ ] Save a draft.
- [ ] Close/reopen the app and reopen the draft.
- [ ] Finalization rechecks current stock.
- [ ] Finalized draft disappears from the draft list.

## Finalization and cancellation
- [ ] Finalization assigns the next invoice number.
- [ ] Stock decrements exactly once.
- [ ] Old invoice prices remain frozen after catalog price changes.
- [ ] Cancelling requires a reason.
- [ ] Cancelled invoice remains visible and marked Annulée.
- [ ] Stock is restored exactly once.
- [ ] Second cancellation is rejected.

## Backup and restore
- [ ] Create a backup to the PC.
- [ ] Create a backup to the flash drive.
- [ ] Restore a previous backup.
- [ ] Pre-restore safety copy is created.
- [ ] Restart after restore and verify data again.

## Printing
Test on the actual client printer.
- [ ] One-page invoice fits A4.
- [ ] Long descriptions wrap.
- [ ] 20–50 line invoice spans pages correctly.
- [ ] Table header repeats on following pages.
- [ ] Totals remain together.
- [ ] Cancelled invoice prints its cancellation notice.
- [ ] Print-to-PDF matches physical preview.

## Delivery
- [ ] Final EXE uses the Ben Mahmoud application icon.
- [ ] Test EXE on client's actual Windows machine.
- [ ] Check Windows SmartScreen behavior for unsigned build.
- [ ] Verify replacing EXE does not delete active database.
