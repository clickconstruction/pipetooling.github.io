# 20260903192740_mercury_category_tags.sql (2026-09-03, v2.2714)

Bank-category tags, PR 1 of Variant D (owner-picked 2026-09-03 after the "label fuel as fuel" work): the data the Banking → Accounting → Tags manager (PR 2) edits.

## What it creates

- **`mercury_category_tags`** — `name`, `icon` (emoji), `color` (one of amber / blue / violet / teal / gray / rose — the six theme families), `sort_order`, `default_key` (unique when set; the seed's identity), `show_as_cost_line` (Review / Job Summary draw the tag as its own cost line), `hide_from_picker`, audit columns.
- **`mercury_category_tag_members`** — exactly one of `bank_category` (a Mercury category string such as `FuelAndGas`) or `label_id` (→ `mercury_drag_sort_labels`, cascade). A bank category (case-insensitive) and a label each belong to **at most one tag** (partial unique indexes), so a cost line never counts a purchase twice.
- **`can_manage_mercury_category_tags()`** — dev / master_technician / assistant / controller, i.e. the people who manage accounting labels (controller added deliberately; the labels policies predate that role). All eight policies use it. Grants to `authenticated`; `service_role` may SELECT (the webhook reads tag membership).
- **`seed_default_mercury_category_tags()`** — SECURITY DEFINER, idempotent: inserts the six default families by `default_key` and their members only where the category / label is not already claimed, so an owner's re-arrangement survives a re-run. Called once by the migration; PR 2's "Reset to defaults" calls it again. Mirrors `DEFAULT_CATEGORY_TAGS` in `src/lib/banking/categoryTags.ts` — keep the two lists identical.
- Ends with both read-only appliers.

## Apply order

- Push after the PR merges, then `npm run gen-types:linked` (new tables), then `supabase functions deploy mercury-webhook` (it now reads `mercury_category_tag_members` for live tag membership — deploying first is harmless: the read fails soft to the criteria snapshot).
- No client behaviour changes until PR 2 ships the manager and the tag clause in the rule editor.
