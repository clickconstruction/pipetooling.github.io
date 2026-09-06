# 20260906160000_identity_aliases.sql (2026-09-06, v2.2950)

Journey map Tier 5 X7 (cluster C34), train T5-07 — one join key for free-text identities, and the merges the key cannot make on its own.

- **`is_office_staff()`** (new): `is_master_or_dev() OR is_assistant()` — the same cohort as `is_banking_staff()`, under a name non-Banking surfaces can use.
- **`identity_aliases`** (new): `(kind, alias_key)` PK → `canonical_key`, `canonical_name`, `decision` (`merge` | `keep`), `created_by`, `created_at`; `kind` ∈ builder · manufacturer · crew_name. Keys are `normalizeIdentityKey()` output (`supabase/functions/_shared/identityKey.ts`).
- **RLS**: ALL for `is_office_staff()`. Both read-only appliers run (CREATE TABLE rule).

Consumers: the Why-we-lost lens keys name-only builders by `name:<canonical key>` and offers "These look like the same builder — Merge / Keep separate", which writes here. Apply order: either — the client reads a missing table as "no aliases" and the prompt's save fails soft with a toast until pushed.
