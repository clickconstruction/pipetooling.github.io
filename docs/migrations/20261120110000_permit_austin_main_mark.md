# 20261120110000_permit_austin_main_mark.sql (2026-11-20, v2.8114)

A one-off for the Austin permits already stored (punch list #405, [v2.8114](../recent-features/v2.8114.md)). No table, no column, no function, so no fence call. One `UPDATE` on `permits`.

## What it does

Austin's feed writes its mark for a contractor's main account into the name: asterisks around `MAIN`, or the word in brackets. `permit-pull` used to keep it, so `permits.contact` showed it and `permits.builder_key` was made from it.

For every row with `city = 'Austin'` whose `contact` matches the mark, of any kind:

- **`contact`** loses the mark, spaces closed up. The pattern is the one `permit-pull` reads with (`AUSTIN_MAIN_MARK` in `supabase/functions/_shared/permitCities.ts`), and `src/lib/research/permitCities.test.ts` fails when the two differ.
- A contact that was nothing but the mark falls to the next name on the row's own `raw`: `applicant_org`, then `contractor_full_name`, then `applicant_full_name`, each cleaned the same way, as the function reads them. With none, the contact is null.
- **`builder_key`** is set to null.
- **`raw`** is not touched.

## Why the key is nulled and not written

The key comes from `builderKeyOf` in TypeScript, which splits the person from the company before it keys the name. The database has `research_name_key` and no twin of that split, so a key written here would be a guess. `permit-pull` fills every row that has a contact and no key, on every run, through `permit_set_builder_keys`: 500 rows a round, 12 rounds, so up to 6,000 rows a run, many times the marked rows.

## Order

1. Deploy `permit-pull` first. A pull by the old function after this migration would write the mark back on the last ten days of permits.
2. `supabase db push`.
3. Run the pull once (**Pull now** on Austin, or the night's run at 11:30 UTC). Until then the cleaned rows have no key, so they are off Builders and the call list.

## Before the push

Read `builders`, `builder_marks`, `builder_customer_answers` and `builder_call_answers` for a row whose key is the key of a marked Austin permit. A row there would be left behind on the old key and has to be carried by hand to the new one. None existed when this was written.

## Safe to run twice

After the first run no Austin contact matches the pattern, so the second run updates nothing. It was run twice on a local Postgres with made-up rows.

## Locks

Row locks on the matched rows only, taken and released in one short statement. `SET lock_timeout = '3s'` heads the file.

## Applied

On the prod ledger, read on 2026-11-21 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here.
