# 20261109004500_gc_remove_bench_company.sql (2026-11-08, v2.6749)

The bench's Remove press (punch list #153): one function, `gc_remove_bench_company(p_company_id uuid)`, the write behind **Remove from the bench…** on a Trade partners row.

- **Why a function and not the client's DELETE**: the office team already holds `FOR ALL` on `gc_companies` (door 2, `20261009040000`), so a plain delete goes through today and cascades the company's asks (`gc_invites`), its call log (`gc_company_contacts`), its promises and its paper sends with it. The rule "a company with history is never removed" has to live where a stale page cannot bend it.
- **The checks, in order**: a work order (`gc_sows`), an ask (`gc_invites`), a logged contact (`gc_company_contacts`), a promise (`gc_trade_promises`), a paper sent or on file (`gc_paper_sends`, `person_contract_documents`), a file or a message from their portal (`gc_trade_files`, `gc_trade_messages`), a Messages thread (`contacts.gc_company_id`), their vetting form (`gc_company_vetting_forms`), an opened portal (`portal_opened_on`), a record on a job (`gc_rfis`, `gc_back_charges`, `gc_trade_change_requests`, `gc_sow_line_reports`). The first found refuses: *‹name› stays on the bench, since they were asked to quote.* A foreign-key violation past the checks is said in the same words.
- **What cascades once the checks pass**: the record itself — `gc_company_people`, an unopened `gc_trade_portal_links` row, `gc_bid_tab_views`.
- **The prospect goes back**: every `prospects` row whose `converted_gc_company_id` is the company leaves `converted` (`prospect_fit_status` null, the id nulled) and gets a `prospect_comments` line, *Removed from the bench: ‹name›. Back on the Subs lane to call.*, so the deck shows the card to call again with its calls still on it.
- **Door**: `SECURITY DEFINER`, `gc_office_team()` in the body; a training account (`is_read_only()`), a digital twin (`is_digital_twin()`) and an archived caller (`caller_is_archived()`) are refused in words before the write, since a definer passes their fences. `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated, service_role`.

No table is created, so no fence call is owed. `CREATE OR REPLACE`, idempotent.

**Order**: push right after the merge. The client calls a function only this migration creates, so `check:calls-ahead` labels the PR *push right after the merge* and the deploy holds until the push; until then the press would read the missing function's name as its refusal. The types regen (`database.ts`, the dev-mcp catalog) follows the push as usual.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
