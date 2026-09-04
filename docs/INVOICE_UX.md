# Invoice UX specification

The invoice flow is the highest-priority workflow.

## Operator flow

**Target:** a common counter sale should require very little navigation.

1. Open **Nouvelle facture**.
2. Customer defaults to **Client comptoir**.
3. Press **F2** or click article search.
4. Search by internal reference, OEM reference, designation, vehicle or category.
5. Add the line; current stock is visible before confirmation.
6. Change quantity/price/discount only if needed.
7. Review the A4 preview on the same screen.
8. **Valider la facture**.
9. Print immediately, save PDF, or both.

## Draft vs finalized invoice

### Draft
- editable;
- may have no final invoice number;
- no stock is permanently removed;
- safe to abandon.

### Finalized
- receives the next invoice number in one database transaction;
- line descriptions/references/prices/taxes are snapshotted;
- stock movements are written;
- totals are frozen;
- cannot be silently edited;
- can be reprinted at any time.

Corrections should use an explicit cancellation/credit workflow later rather than rewriting history.

## Printed document

### Visual hierarchy

- Brand/company identity is compact, not decorative.
- **FACTURE + number + date** has the strongest hierarchy.
- Customer details have a fixed location.
- Item table dominates the center of the page.
- Totals are grouped at the lower right.
- Business address and phones repeat in a discreet footer.

### Print constraints

- A4 portrait first.
- Works in grayscale.
- Brand blue is only an accent.
- Table headers repeat on page 2+.
- Rows should not split in confusing ways.
- Totals block should remain together.
- Long designations wrap.
- Currency renders with three Tunisian decimal places.
- No buttons/toolbars appear on paper.
- Arabic invoices must use RTL layout and an Arabic-capable system font.

## Business settings still to confirm with the client

Before production release, verify:
- exact legal company name spelling;
- tax identifier / matricule fiscal and whether it must appear;
- invoice tax rules and default TVA;
- whether prices are normally entered/displayed HT or TTC;
- payment methods to print;
- whether delivery notes / bons de livraison are needed;
- whether credit notes / avoirs are needed;
- preferred printer and paper size;
- invoice numbering format;
- whether customer tax identifiers are required.

These are deliberately settings rather than hard-coded assumptions.
