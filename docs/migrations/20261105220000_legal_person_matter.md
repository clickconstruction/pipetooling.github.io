# 20261105220000_legal_person_matter.sql (2026-11-05, v2.6543)

PR 3a of punch list #269. A legal matter that stands on a person instead of a Collections payer, so the analysis for counsel about a former teammate has the desk's shape — a narrative for the firm, documents with a hash and a state, a timeline of planned steps and events — on the HR file's Matter view.

- `legal_matters.kind` (`account` for every row so far, `person`), `legal_matters.person_id` (→ `people.id`, `ON DELETE RESTRICT`), `legal_matters_kind_check`, `legal_matters_person_kind_check` (`kind = 'person'` exactly when `person_id` is set), and a partial unique index on `person_id`: one matter a person. A person matter's `payer_key` is `p:<person_id>`, so the `UNIQUE` holds and the desk's account lookups never match it.
- `legal_matter_is_person(matter_id)` (definer) and five restrictive policies, `<table>_person_dev_only` on `legal_matters`, `legal_matter_jobs`, `legal_matter_entries`, `legal_matter_documents` and `legal_matter_gap_answers`: a person matter's rows are a dev's on every verb; the office roles' permissive policies are untouched for account matters.
- `legal_person_matter_open(p_person_id, p_handling_name)` (devs only): opens the matter — stage `review`, nothing released, the person's name as `payer_name` — or returns the one that stands; replies `{ ok, matter_id, stage, closed, made, person_name }`.

No table is created, so no fence calls. Apply order: **push right after the merge** — the Matter view reads `legal_matters` by `person_id` (a filter on a column that is not there is refused, which the view reads as no matter, so the old client stands), and Open a matter… calls the new function.
