# 20261108120000 — job_contracts_their_paper (v2.6698)

Their paper (punch list #173, `to-dos/contract-their-paper/`): a contract on the other side's own form, signed by us and not countersigned, recorded as it is instead of as *signed by the customer*. Additive and idempotent; no table is created, so no fence call.

- **Eight columns on `job_contracts`**: `paper_title`, `our_signer_name`, `our_signed_on` (date), `our_signed_how`, `their_signed_on` (date; NULL = not countersigned), `relied_on_on` (date) + `relied_on_what` (the owner's flag: with both, the paper counts as signed for the Legal desk), `key_terms` (jsonb list of `{ key, clause, words }`).
- **`job_contracts_kind_known`** is dropped and re-added to allow `their_paper` beside `contract` and `warranty` (the swap runs only while the constraint lacks the new value, so a re-run leaves it).
- **`job_contracts_key_terms_list`**: `key_terms` is NULL or a JSON array. **`job_contracts_their_paper_shape`**: a their-paper row names who signed for us, and a relied-on day carries its words.
- Comments on the kind and the eight columns.

The row keeps `signed_at` and the signer frames empty, so the activity bridge (which fires on `signed_at`) writes nothing for it and no reader that knows only the frames mistakes it for a contract the customer signed. RLS is the table's: the office set (dev, assistant-like, the job's master) reads and writes it as it does every contract row.

**Push right after the merge**: the client's *Record their paper* writes the new kind and columns, and `check:calls-ahead` cannot see a column, so the deploy does not wait for the push; before it the write is refused by the kind constraint with its reason, and every read works as before (the paper's own columns are read only for rows whose kind says `their_paper`). Then `supabase functions deploy legal-portal` (its select names the new columns) and `npm run gen-types:linked` as its own `chore(types)` PR.
