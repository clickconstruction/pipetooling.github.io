# 20261007030000_gc_create_project.sql (2026-10-06, v2.4716)

GC mode, the real build, step 4a: the RPC New project writes through (`to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md` → *Writing it: three RPCs*, on branch `spike/gc-mode`). One function, no table.

**`gc_create_project(draft jsonb) RETURNS uuid`**, `SECURITY INVOKER`, `search_path = public`: takes the prototype's `NewProjectDraft` as jsonb and, in one transaction, inserts the `projects` row (its number from the sequence), `gc_projects` (stage `bidding`, bid due, size, who we work for, the property's owner, the architect), each trade in `gc_trade_packages` with its `gc_scope_items` (sheets and sections as tied, null to follow the guess) and `gc_scope_exclusions`, and set 0 in `gc_plan_sets` (its kind, day, note, checker, Drive link and last check) with every sheet and section as an issued `gc_plan_set_items` row. A customer, architect or property owner named for the first time becomes a commercial `customers` row with the caller as its master. It refuses a draft with no name, no customer, or a role it does not know, in plain words. The prototype's `ownersRep` is written as the table's `owners_rep`.

Because it is `SECURITY INVOKER`, RLS decides who may: today only a dev can write the `gc_*` tables, and the `projects` and `customers` rows follow their own policies. `EXECUTE` is granted to `authenticated` and revoked from `PUBLIC` and `anon`.

Apply order: after `20261006233000` and `20261006234000` (the tables it writes). No client calls it until the New project page lands (step 4b). Idempotent (`CREATE OR REPLACE`).
