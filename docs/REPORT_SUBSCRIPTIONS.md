# Report Subscriptions System

---
file: REPORT_SUBSCRIPTIONS.md
type: Architecture/Reference
purpose: Names and defines the app's recurring/scheduled report-email pattern — streams, request tables, cron dispatchers, fresh-at-send builds, and the My Email Schedule surface — and the checklist for adding a new stream
audience: Developers, AI Agents
last_updated: 2026-08-06
key_sections:
  - name: "What the system is"
  - name: "The five pieces"
  - name: "Stream inventory"
  - name: "Design rules"
  - name: "Adding a new stream (checklist)"
---

## What the system is

**Report Subscriptions** is the app's pattern for report emails a user can *subscribe to*: schedulable for a future date/time, weekly-repeatable, rebuilt **fresh from live data at send time**, and self-listing on the recipient's **Settings → Your account → My email schedule / My email subscriptions** surface. Any report email that follows the pattern is called a **stream**.

The name was coined in v2.1424; the pattern itself was built out for the Billed Awaiting Payment report in v2.1315–v2.1330. This doc names the pieces so new streams (e.g. GC statements) plug in consistently.

## The five pieces

Every full-featured stream is made of the same five parts:

1. **A share modal with scheduling** — the sender picks a recipient, chooses **Send now** or **Schedule…** (date + time, Central / `APP_CALENDAR_TZ`), optionally **Repeat weekly**, can **Preview** / **Email me a test**, and sees their pending sends with a **Cancel** each. Reference implementation: [`BilledReportShareModal.tsx`](../src/components/jobs/BilledReportShareModal.tsx) with client helpers in [`billedReportEmailClient.ts`](../src/lib/billedReportEmailClient.ts).
2. **A request table** — one row per scheduled send: `send_at`, recipient, `repeat_weekly`, `sent_at`, `requested_by`. Reference: `billed_report_email_requests` (migration `20260803100000`), `schedule_day_email_requests`. **No report snapshot is stored** — only the request.
3. **A cron dispatcher** — a pg_cron entry (typically every 5 minutes, Vault `project_url` + `cron_secret`) invokes an edge function that finds due rows, **rebuilds the report at send time** via a service-role payload RPC, renders HTML in the function, sends via Resend, and stamps `sent_at`. A `repeat_weekly` row **re-inserts itself for +7 days** on successful send — the self-perpetuating chain (v2.1323); cancelling the pending row ends the chain. Reference: [`billed-report-email`](../supabase/functions/billed-report-email/index.ts).
4. **A service-role payload RPC** — SECURITY DEFINER, EXECUTE revoked from clients, reproducing the client surface's math server-side (the dispatcher has no client to compute it). Fidelity is verified against the client surface before shipping — the billed-report RPC was verified against prod to the penny (v2.1316).
5. **Schedule + subscriptions surfaces** — [`get_my_email_schedule()`](../supabase/migrations/20260803120000_my_email_schedule_rpc.sql) (self-scoped SECURITY DEFINER; only ever returns rows addressed to `auth.uid()`) aggregates every stream for the caller; `get_global_email_schedule()` is the dev-only global view. [`SettingsMyEmailScheduleSection.tsx`](../src/components/settings/SettingsMyEmailScheduleSection.tsx) renders the weekly grid ("My email schedule") and the standing-streams list ("My email subscriptions", normalized by [`emailScheduleWeek.ts`](../src/lib/emailSchedule/emailScheduleWeek.ts)).

Not every stream carries all five pieces — event-driven streams (paid-in-full, payment-received, estimate-accepted) have no request table or scheduling UI; they appear only in the subscriptions list. The five-piece shape is the target for *report* streams.

## Stream inventory

| Stream key | Kind | Request table / source | Dispatcher | In schedule grid | In subscriptions list |
|---|---|---|---|---|---|
| `report_digest` | weekly digest | `recurring_job_report_schedules` + `_recipients` | `recurring-job-report-dispatch` | ✅ weekly slots | — |
| `billed_report` | scheduled report | `billed_report_email_requests` (`repeat_weekly`) | `billed-report-email` | ✅ one-offs + weekly chains | — |
| `schedule_day` | scheduled report | `schedule_day_email_requests` | `schedule-day-email-dispatch` | ✅ | — |
| `paid_in_full` | event | `app_settings.paid_job_email_recipients_v1` | `paid-job-email` (queue trigger) | — | ✅ |
| `payment_received` | event | `app_settings.payment_made_email_recipients_v1` | `paid-job-email` (`kind` column) | — | ✅ |
| `estimate_accepted` | event | `estimates.accept_notify_user_ids` (+ always-list) | accept flow | — | ✅ (v2.1330) |
| `gc_statement` | scheduled report | `gc_statement_email_requests` (v2.1426; free-text `sent_to`; scheduling UI v2.1427) | `gc-statement-email-dispatch` | ✅ requester-scoped (v2.1428) | — (scheduled report, not an event stream) |

## Design rules

- **Fresh at send time.** Dispatchers never store report content; a Monday 7 AM email shows Monday's numbers. If a payload can't be built, the send fails visibly (row stays pending with an error), never silently sends stale data.
- **The weekly chain is rows, not config.** `repeat_weekly` re-inserts next week's row on successful send. The grid labels chains "weekly"; cancelling the pending row ends the chain.
- **Payload RPCs are service-role only** and must be fidelity-verified against the client surface they mirror before first dispatch.
- **Recipient scoping:** `get_my_email_schedule()` lists rows *addressed to* the caller. Streams that can send to **outside email addresses** (no user row — e.g. a GC's AP inbox) list on the **requester's** schedule instead, labeled with the destination address ("→ accounting@example.com").
- **Audit separately from requests.** Actual sends log to `email_send_log` (best-effort) and any stream-specific audit table (e.g. `gc_statement_emails`); the request row's `sent_at` is the dispatch record.
- **Internal-only vs external recipients** is a per-stream decision made at the table level: `recipient_user_id` FK for internal-only streams (billed report), a free-text `sent_to` for streams that may leave the company (GC statements).

## Adding a new stream (checklist)

1. **Payload RPC** (migration): service-role-only SECURITY DEFINER function reproducing the surface's math; verify fidelity against the live surface read-only before proceeding.
2. **Request table** (migration): `send_at timestamptz`, recipient (`recipient_user_id` or `sent_to text`), `repeat_weekly boolean default false`, `sent_at`, `requested_by`, stream-specific params. RLS: requester can SELECT/INSERT/DELETE own pending rows; both read-only block sweeps.
3. **Dispatcher edge function** + pg_cron entry (5-minute cadence, `X-Cron-Secret`): due-row scan → payload RPC → HTML render → Resend → stamp `sent_at` → weekly re-insert → audit.
4. **Share modal scheduling UI**: Send now | Schedule… + Repeat weekly + pending list with Cancel (copy the `BilledReportShareModal` shape).
5. **Schedule integration**: extend `get_my_email_schedule()` and `get_global_email_schedule()`; add the stream's tone/label in `SettingsMyEmailScheduleSection.tsx` and, for event-like behavior, `normalizeMyEmailSubscriptions`.
6. **Docs**: EDGE_FUNCTIONS.md section, MIGRATIONS.md entries, help guide, RECENT_FEATURES + release note, and a row in this doc's inventory table.

## The GC statements stream (`gc_statement`) — SHIPPED

Built 2026-08-06 as the pattern's second full stream (v2.1425–v2.1428): payload RPC `get_gc_statement_email_payload` (fidelity-verified against prod), `gc_statement_email_requests` (free-text `sent_to` — the first stream with outside recipients), `gc-statement-email-dispatch` cron edge fn (empty single-entity statements skipped, weekly chains still advance), scheduling UI in GC Review's Email…/Share-all dialogs with a pending-sends list, and requester-scoped My-email-schedule listing.
