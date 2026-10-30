# The made-up bills (punch list #179)

Five supply-house papers drawn as PDFs, each beside the answer the model should give for it in `BILL_SCHEMA`'s shape (`supabase/functions/_shared/billRead.ts`). Every house, job, person, number and amount is made up: Ridgeway Supply, Cedar Bend Pipe & Supply, Oakmont Dental, Riverbend Self Storage, Todd.

| File | What it tests |
|---|---|
| `ridgeway-S1183420` | The card's bill: five lines that add to $952.28 with the tax, PO 41207, the ship-to names the job. |
| `ridgeway-CM-20991` | A credit memo for four valves returned, naming the invoice it credits on its RE: line. |
| `ridgeway-S1183455-wrong-total` | Seven lines that add to $1,248.10 under a printed total of $1,284.10: the sum check fails. The PO prints the job name, not a code. |
| `cedar-bend-CB-77102` | A bill from another house, so the letterhead check fires when the form is open on Ridgeway Supply. |
| `ridgeway-statement-oct-2026` | A statement listing four papers with a balance forward: one bill at a time. |

- **Regenerate** with `node scripts/bills-fixtures.mjs` (one data object draws the paper and writes the answer; the dates are fixed so a re-run writes the same bytes). Change the data there, never the PDF or the answer by hand.
- **The kernels' tests** (`src/lib/materials/bills/*.test.ts`) read the answers.
- **The live trial**, once `bill-read` is deployed and the key is in: `node scripts/bill-read-compare.mjs --jwt <access token> --house <a ZZ test house's id> [--model claude-haiku-5-5]` sends each PDF to the function and scores the answer against the file beside it.
