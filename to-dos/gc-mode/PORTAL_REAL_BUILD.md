---
name: "GC mode, the trade partner's portal: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81); BUILD_MAP.md section 3, Helper 3's row; PLAN_2026-10-07.md
status: planned 2026-10-07 by Helper 3 (Portal) for the lead (GC spike) · seams agreed the same evening with Helper 1 (schedule), Helper 2 (Board), Helper 4 (Building), Helper 5 (Owner Billing) and Helper 6 (New project's tail) · nothing built; waits for the lead's go
summary: >
  How the trade partner's company portal moves from the prototype (made-up data on branch
  spike/gc-mode) onto main: one no-password link per company on the sub portal's pattern, one
  read function that returns only that company's rows, one submit function whose every kind calls
  a SQL function owned by the lane whose table it writes, and one email sender every lane calls.
  Six steps, P0 to P5; P1 on day 2 (10-09), P2 and P3 on day 3, a friendly trade on a real link
  on day 4.
size: L (4 tables, 2 RPCs for the office, about 30 trade functions across five lanes, 3 edge functions, about 14 PRs)
blocker: the lead's go on this plan; B1 (the company record) merged and pushed before P1a; B2's Board kernels on main before P1b's home
---

# GC mode, the trade partner's portal: the real build plan

## What moves, and what stays

**Moves, in this plan:**
- **The link.** One link per company, with no password. The link is the key, as on the sub portal,
  but keyed to a company (`gc_companies`) instead of a person. The office makes it, copies it,
  makes a new one, and turns it off.
- **The portal page** at `/t/:token`: the company's home, a project's page, Their messages, the
  people who get our emails, English or Spanish, the first visit's welcome, and printing.
- **The reads**: `portalHome`, `portalAsks`, `portalPay`, `portalWeeks` and Their messages, through
  one edge function (`gc-trade-portal`) that returns only that company's rows.
- **Every trade-side write**: the 37 `trade*` actions in `gcTypes.ts`. Each one is a kind on one
  submit function (`submit-gc-trade-portal`).
- **Every email to a trade**: one sender (`gc-trade-email`) that every lane's screen calls with a
  kind. It goes through Resend, in English or Spanish, to the people the company named for that
  kind.
- **The portal's own records**: back-charges and a trade's change requests (P4).
- **The portal's words**: the rest of `gcPortalI18n.ts`, into main's `src/lib/gc/portalI18n.ts`,
  which the schedule's PR 1b started.

**Stays with the lanes that own it.** This plan only points at these. A step below that needs one
of them says so.
- The company record, its people, the invitations, the quotes and the promises: the Board (B1).
- The office's screens for asking, comparing and awarding: Board B4 to B6.
- Papers (the master agreement, the statement of work, insurance, W-9): the Board (B6), on main's
  `person_contract_documents`.
- Draws, pay applications, waivers, the punch list, submittals and RFIs: Building (U1 to U6).
- Change orders to the customer: Owner Billing (O1, O3).
- The schedule's records (moves told, late notices, crew counts, the look-ahead): the schedule,
  Helper 1 (PRs 13, 14 and 16).

## Agreed with the other lanes (2026-10-07 evening)

| Seam | Agreed |
|---|---|
| **The pattern for every trade write** (Helpers 1, 2, 4, 5) | Each trade write is a SQL function `gc_trade_<verb>(p_company_id uuid, …)`. It is `SECURITY DEFINER` with a pinned `search_path`, REVOKEd from `PUBLIC`, `anon` and `authenticated`, and GRANTed to `service_role` only. It checks that the row is that company's and writes it with the owning lane's rules. It raises `P0001` in plain words and returns the row's id. The submit function only resolves the link to its company, rate-limits, and calls it. **A company never comes from the request body.** |
| **The company record** (Helper 2, B1) | The table is `gc_companies`, and readers say `company_id`. B1 adds the missing foreign keys on main's `gc_plan_questions`, `gc_plan_set_sends` and five `gc_schedule_*` tables. The portal reads `name`, `contact_name`, `email`, `phone`, `trades`, `lang` (`en`/`es`, default `en`, CHECKed), `contact_gets` (null = all four groups, CHECKed subset), `portal_opened_on`, `address` (where they drive from, and the pay application's mailing address), `max_miles`, `license`, and `vetting_status` / `vetting_limit` / `vetting_decided_on`. The form is a 1:1 side table, `gc_company_vetting_forms`. People are `gc_company_people(id, company_id, name, email, role, gets, added_by office/trade, created_at, removed_at)`. |
| **Invitations, quotes, contacts, promises** (Helper 2, in B1's migration so P1 reads them on day 2) | `gc_invites(package_id, company_id, status, invited_on, invited_by, seen_rev, nudged_on, declined_*)`, unique per package and company. The office-only numbers (`plugs`, `exclusion_covers`, `taken_alternates`) sit on the invite and the portal never selects them. `gc_quotes` is append-only, and the newest per invite counts. `gc_company_contacts` holds one table for both levels; **the quote day a trade gives is a line with `invite_id` set, `how` = `portal` and `promised_by`**. `gc_trade_promises` and `gc_trade_promise_moves` take every other promise kind. B1 also carries a dev-only `gc_invite_companies(package_id, company_ids[])`, so a test invite exists before B4's window. B1 has no trigger or CHECK that needs `auth.uid()`, and a `from` column says office or trade. |
| **Papers** (Helper 2) | No paper columns on `gc_companies`. B6 adds `company_id` to `person_contract_documents` (doc_type agreement/w9/coi, status, signed_at, expires_at, form hints, the `/contract/accept` signing flow), and the mapper derives `Partner.msa`, `msaSentOn`, `msaSignedOn`, `coiExpires` and `w9` from those rows. The portal reads them once B6 lands, and P5's insurance and W-9 kinds write there. One paper system. |
| **Who writes the Board's trade functions** (Helper 2) | This plan writes them in its own migrations, and Helper 2 reviews them, so B1 stays tables plus the office's RPCs. **A trade function that does what a promise asked for calls B1's `gc_keep_promises(p_company_id, p_kind, p_project_id, p_package_id, p_on)`**, as `promisesKeptBy` did: signing the master agreement (`msa`) and a statement of work (`sow`), insurance (`insurance`) and the W-9 (`w9`). Building's pay application, punch and submittal functions do the same for their kinds. |
| **The Board's kernels the portal reads** (Helper 2, B2-i on day 2) | B2-i lifts `gcBids`, `askPromise` and `OPEN_WITHIN_DAYS`, `vettingOf`, `tradePromisesOf` / `tradePromiseState` / `PROMISE_WHAT`, `firstSendLines`, and `preBidInvited` (into `src/lib/gc/preBid.ts`). `paperSendMessages` reads the portal's word table, so it moves with P3. `mailRecipients`, `contactGets` and `PORTAL_MAIL_GROUPS` go in `src/lib/gc/portal.ts`: whichever of P0 and B2-i is cut first places them, and the other imports them. P0 is due first. |
| **Building** (Helper 4) | Back-charges are the portal's record (P4). Building owns the office screen on Draws, and U6 adds `taken_draw_id`. The trade functions on Building's tables are Building's: `gc_trade_punch_fixed` (U3), `gc_trade_submittal_send` (U4), `gc_trade_rfi_ask` (U5), then the SOW reports and the four draw verbs (U6). The portal reads Building's kernels from `src/lib/gc/` after U2 lifts them (day 2), and Building's Spanish moves to `src/lib/gc/buildingWords.ts` on `portalI18n`'s `PortalLang`. |
| **Owner Billing** (Helper 5) | `gc_trade_change_requests` is the portal's (P4), with `change_order_id` FK to O1's `gc_change_orders`, which exists by then. The office's answers are Helper 5's RPCs (`gc_draft_change_order_from_request`, `gc_turn_down_change_request`), SECURITY INVOKER under office RLS on the portal's table. A trade's signature on a change goes on Building's `gc_change_order_trade_sends` through Helper 4's `gc_trade_sign_change` (U6). **"Your part" is the change order's cost on the trade's package**, never the customer price, our fee or the total. |
| **The schedule** (Helper 1) | P0 lifts the portal's words first, which unblocks the schedule's seven functions that wait on them. Helper 1's PR 13 ships `gc_trade_answer_dates`. PR 14 ships `gc_trade_say_late`, `gc_trade_keep_day`, `gc_trade_set_crew_count` and `gc_trade_mark_lookahead`, and waits on B1 and B6. `tradeReportPart` ships in Helper 1's PR 16 beside U6, as one function both lanes review. None of these touch `gc_schedules.version`, because they are records. The portal imports the schedule's kernels from `src/lib/gc/schedule/` and never copies them. |
| **New project's tail** (Helper 6) | Step 7 (the set email) calls `gc-trade-email` with kind `plans`, once per company on each touched trade, and writes its own `gc_plan_set_sends` rows from the ids the sender returns. `gc-plan-set-email` is not built. The answer to every company quoting a trade is kind `answer`. `gc-plan-question-email` stays, because the architect is a customer, not a trade company. The portal reads main's one fold of a set (`sheetsInSetAt`, `sheetsGoneAtSet`, `specsInSetAt`, `specsGoneAtSet`), never a second. `quotesWantedOn` and `questionsFor` join `src/lib/gc/questions.ts`. `preBidInvited` is the Board's (B2). |
| **The Board's and the schedule's emails** | Nothing in another lane sends to a trade on its own. B4's Ask window, B6's papers, U6's draws, O3's answers and the schedule's PR 13 all call `gc-trade-email` with their kind. |

## Decisions before the first migration

Each has a default the plan is written to. The lead takes them to the owner in one list.

1. **The address.** *Default:* `/t/<token>`, as the prototype writes it (`clicktooling.com/t/…`),
   public and lazy-loaded. There is no short custom address yet. The sub portal's
   `my.clickplumbing.com/<slug>` is the plumbing company's name, and the GC entity is not named yet
   (call 12). A short address and a QR on printed papers come after call 12.
2. **The token.** *Default:* the sub portal's exactly. A 64-character random token is kept raw
   (so the office can copy it again) and as a SHA-256 hash. It has no expiry, and *Turn it off* is
   the kill switch. *Make a new link* turns the old one off in the same transaction.
3. **Who makes a link.** *Default:* dev only (`is_dev()`) until a door PR opens it to the office
   roles, as Helper 6's doors do. The page itself cannot be gated: a trade has no login. So **no
   real trade gets a link until a dev makes one**, and that is the dev door for this lane.
4. **Where the portal's logic runs.** *Default:* in the browser. The read function returns the
   company's rows (*the slice*), and the page maps them into the prototype's shapes and calls the
   lifted kernels (`portalHome`, `portalAsks`, …). The other way, the sub portal's way, has the
   server build the whole view. That needs every kernel in Deno, and Helper 1's decision 10 is
   still proving whether an edge function can bundle `src/lib`. The slice is the security
   boundary, so it is built by one pure builder in `supabase/functions/_shared/` with a test that
   it never carries what a trade may not see (*What a trade never sees*, below).
5. **Their messages reads what was sent, not what the data says now.** The prototype computes a
   company's messages from the state (`portalMessages`). Real messages are kept as they went, in
   `gc_trade_messages`, and the portal reads that table. `portalMessages` becomes the *builder*
   that each office screen calls to write the words before it sends. *Why:* a message must read
   as it went after the data changes ("a sent bill keeps what it went with"), and only sent mail
   exists for real.
6. **Who writes an email's words.** *Default:* the office's screen. It builds the message with the
   lifted `portalMessages` words, picks it by its key, and sends `{companyId, kind, key,
   projectId, subject, lines, lang}`. The function checks that the sender is office, that the
   company has an invite on the project, and the kind. Then it finds the recipients itself from
   the company record by the kind's group (`mailRecipients`), adds the link, wraps the words in
   one frame builder in `_shared/gcTradeEmail.ts`, sends through Resend with the project manager
   as Reply-To, files the sent copy, and keeps the message. `(company_id, key)` is unique, so a
   double press never sends twice, and a reminder has its own key. *The other way:* build every
   kind's words on the server, which needs the same Deno question as decision 4.
7. **Automatic emails** (insurance running out 30 days before, start in 14 and 3 days).
   *Default:* not in P3. Every email in P1 to P4 goes out on an office press. The two timed kinds
   become a cron dispatcher (with its `verify_jwt = false` block) only on the owner's yes, since
   the prototype only ever wrote them.
8. **Spanish.** *Default:* built whole in P0 (every word, the Español button, Spanish emails), but
   **held by one constant until a native speaker reads it (call 9)**. Until then the Español button
   is hidden, a Spanish company's email goes in English, and its `lang` is kept for the day it
   flips. Flipping it is a one-line PR with the reader's name in its fragment.
9. **Files** (a quote's PDF, an insurance certificate, a change request's photo, a submittal).
   *Default:* files live in Drive, by the owner's call. One kind, `file`, puts a PDF or photo (10
   MB at most) in the project's Drive folder, under *Team only → From trades → <company>*, through
   `_shared/driveUpload.ts`, and returns the link the next kind stores. It lands first in P5.
   Until then the portal's file pickers are hidden and say "Email it to <project manager>".
10. **After a press.** *Default:* the page reads the slice again (one GET), with no optimistic
    copy of the prototype's reducer. That gives one source of truth, and the sub portal's "props
    seeded once" hazard never starts.
11. **Errors in the trade's language.** *Default:* every refusal is a key the page translates
    (`linkOff`, `questionsClosed`, `tooMany`, …), not an English sentence. That fixes the sub
    portal's English-only errors on this page.
12. **What customers see.** *Default:* the portal and its email take steps in the existing `sub`
    journey ("GC mode: a trade partner's portal", "GC mode: an email to a trade partner"). There
    is a sample token, a sample slice in its own `_shared/gcTradePortalSample.ts` (never in
    `customerSampleFixtures.ts`, which ~49 functions import), and a sample email through the same
    frame builder. A sample token's write answers `ok` and writes nothing, on the server, so the
    walkthrough never errors. A `trade` journey of its own is the alternative if the tab gets
    crowded.

## The tables

Every migration follows `CLAUDE.md`. It starts with `SET lock_timeout = '3s';`, is numbered from
`origin/main` and claimed at the cut, is idempotent, and ends a CREATE TABLE with the three block
calls (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`,
`apply_digital_twin_write_blocks`). RLS is on everywhere. The office reads under dev-only policies
until the door, but for `gc_back_charges`, which the money team reads since Owner Billing's O9
(v2.5133, a `FOR SELECT` policy beside the dev one), since each draw's net takes off the charges taken.
Writing it waits on the door. The trade never touches a table except through the service role.

**`gc_trade_portal_links`** (P1a), the sub portal's `sub_portal_links` keyed to a company: `id`,
`company_id` (FK `gc_companies`, cascade), `token`, `token_hash`, `created_by`, `created_at`,
`revoked_at`. There is one active link per company (a partial unique index where `revoked_at IS
NULL`), and `token` is unique. There are no opened columns. Who opened it, and when, is
`public_page_views` (surface `gc_trade_portal`, `entity_id` = the company), stamped outside,
staff or preview the way the sub portal's is.

**`gc_trade_messages`** (P1a, written from P3), every email we sent a company, as it went: `id`,
`company_id`, `project_id` (null: about the company), `kind` (CHECK, the 19 `PortalMessage` kinds
plus `paper` for the company window's paper sends), `mail_group` (quotes, job, contracts, pay),
`msg_key` (the prototype's message key), `lang`, `subject`, `lines` (jsonb, one paragraph each),
`to_names` (text[]), `sent_on` (date in the app's zone), `sent_at`, `sent_by`, `email_send_log_id`
(FK `email_send_log`, so `resend-webhook`'s delivered and opened come with it), and unique
(`company_id`, `msg_key`).

**`gc_back_charges`** (P4a), `BackCharge`: `id`, `project_id`, `package_id`, `company_id`,
`amount` (> 0), `reason`, `photo_url` (a Drive link, null), `sent_on`, `answer_by` (`sent_on` +
`BACK_CHARGE_ANSWER_DAYS`), `status` (open, agreed, disputed, kept, dropped), `answered_on`,
`answer_note`, `settled_on`, `settled_note`, `settled_by`, `taken_draw_id` (no FK until U6 adds
it), `taken_on`, `created_by`, `created_at`.

**`gc_trade_change_requests`** (P4a), `TradeChangeRequest`: `id`, `project_id`, `package_id`,
`company_id`, `asked_on`, `description`, `reason` (owner, field, plans), `amount`, `days` (≥ 0),
`file_url`, `change_order_id` (FK `gc_change_orders`), `turned_down_on`, `turned_down_note`,
`created_at`. The office RLS lets Helper 5's two RPCs write `change_order_id` and `turned_down_*`.

`public_page_views`' surface CHECK gains `gc_trade_portal` in P1a. That is one constraint swap on
an insert-only table, under the lock timeout.

## What a trade never sees

The read function selects by the link's company in SQL, and the slice builder then copies only
the fields on this list. Its test builds rows with marked values in every field outside the list
(a budget of 777,777, a fee of 12.34%, a plug, a cover cost, a taken alternate, the customer's
price on a change order, another company's name and number, an office call note, a lost bid's
note, `won_by`) and checks that none of them appears anywhere in the slice's JSON.

| In the slice | Never in it |
|---|---|
| The company's own row, its people, its own invites, quotes and quote days | Other companies, their quotes and their names (the bid tab comes only as B5's `bidTabResult` gives it, names hidden unless the office shared them) |
| Each asked project's name, address, stage, bid day, lost day and the one-line why | The customer, our number, budgets, general conditions, contingency, fee, `won_by`, the lost note |
| The asked trades' scope lines, sheets, sections and known exclusions | `plugs`, `exclusion_covers`, `taken_alternates`, `own_bid_id` |
| Every plan set, its sheets and its Drive link | The office's notes on an ask: only the line's day, how and promised day come through, and the words only when `how` = `portal` |
| Answered questions on its trades, never who asked; its own questions in full | Another company's questions and names |
| Its statements of work, draws, back-charges, change requests and their parts (as their lanes land) | The change order's price, total or fee: only "Your part" |
| The schedule of its projects, with dates and names and no money | |
| The messages we sent it | Messages to anyone else |

## What the app already has, reused

- **The sub portal** (`docs/SUB_PORTAL_ARCHITECTURE.md`): the link table's shape, `mint_*` /
  `revoke_*` RPCs, the read function's resolve-then-count, `publicViewDecision` and
  `public_page_views`, the honeypot, the token length check and the per-link hourly cap. Its
  hazards are fixed here from the start: writes carry `staffAwarePublicHeaders()`, sample tokens
  short-circuit on the server, there are no `requestToken` slugs, and errors are keys.
- **The company record, invites, quotes, contacts and promises**: B1. **Papers**:
  `person_contract_documents` and the `/contract/accept` flow, through B6.
- **Questions about the plans**: `gc_plan_questions` and the closing-day rule that
  `gc_record_question` keeps (8a). The trade's question goes through the same check.
- **The project's rows and folds**: `gcProjectFromRows`, `sheetsInSetAt` and the rest of
  `planSetReads.ts` and `questions.ts`.
- **Email**: `sendEmailViaResend` with `file:` (the sent copy, `docs/SENT_COPIES.md`) and
  `COMPANY_EMAIL_FROM`, the project manager as Reply-To, `email_send_log`, and `resend-webhook`.
- **Drive**: `_shared/driveUpload.ts` and the project's Drive folders from `gc-drive-access`.
- **The schedule's kernels and records**: `src/lib/gc/schedule/` and the `gc_schedule_*` tables.
- **Printing**: the prototype's `printPortalHtml` moves with the page. The portal frame stays
  `data-theme="light"` with its paper look.

## Kernels that move, measured

Measured on the spike at e8f61a36f, with a trace of each export's closure across
`src/lib/gcMode`. The scratch tracer counts types, `money`, `currentRev`, `planLabel` and
`GC_COMPANY` (main's `company.ts`) as coming along. The lift itself uses
`to-dos/gc-mode/scripts/lift-extract.cjs` with `portal-p0.lift.json`, and `lift-same.cjs` proves
it word for word.

- **70 move now (P0)**, of `gcPortal.ts` and `gcPortalI18n.ts`. These are all of the words (689
  keys, `pt`, `portalString`, `PORTAL_KEYS`, `pTime`, `EXCLUSION_ES`, `pExclusion`,
  `pDiscipline`), who gets which email (`PORTAL_MAIL_GROUPS`, `contactGets`,
  `everyMailGroupCovered`, `mailRecipients`, `portalMailGroup`), back-charges (`backChargeState`,
  `backChargeCanTake`, `backChargeDraws`, `backChargesToAct`, `portalBackCharges`), change
  requests (`changeRequestState`, `openChangeRequests`, `portalCanAskChange`,
  `portalChangeRequests`), the look-ahead and the weeks (`portalLookAhead`, `lookAheadOwed`,
  `portalWeeks`), the plans news, insurance, contacts, alternates and the first visit. Also
  `gcCompanyPortal.ts`' free functions, and `gcBackChargesWaiting.ts` and
  `gcChangeRequestsWaiting.ts` (the dashboard's two Needs you lines), whose only spike import is
  `gcPortal.ts`. Board, Building and Owner Billing read several of these (*Who reads whose code*),
  so landing them first helps every lane.
- **24 wait**:
  - on **Board B2-i** (day 2): `portalAsks`, `portalPromiseLine`, `bidRanOut`, `linkNeverOpened`,
    `portalVetting`, `portalPromises` and `portalPreBid`, through `gcBids`, `gcFollowUp`,
    `gcVetting`, `gcPromises`, `firstSendLines` and `preBidInvited`. `paperSendMessages`, which
    reads the portal's words, moves in P3 with `portalMessages`;
  - on **Building U2**: `portalJobMoney`, `portalPay` and `portalPapers` (`gcBuilding`), and the
    SOV checks (`gcTheirSov`; the lead says which lane lifts it);
  - on **New project, done in P0 with Helper 6's OK**: `quotesWantedOn` (an alias of
    `questionsCloseOn`) and `questionsFor`, added to `questions.ts`; `portalLines` reads main's
    folds with one declared change (decision in *Agreed*);
  - on **the schedule after P0**: `datesMessage`, `datesNotices` and `startReminders`, which wait
    on P0's words themselves;
  - and the three that read all of the above: `portalTodos`, `portalHome` and `portalMessages`.
    They lift the hour their last callee is on main, expected day 2 for the first two and day 3
    for `portalMessages`. If one callee slips, the page ships without that block. `portalHome` is
    never forked into a smaller copy.
- **Tests.** `gcPortalI18n.test.ts` moves as it is. `gcPortal.test.ts` and `gcSpanishVoice.test.ts`
  play the prototype's reducer, so they stay on the spike. Main gets direct tests for what moved,
  and a voice test that scans the lifted word table with the same `SPANISH_TERMS` and
  `TU_MARKERS`. The spike's follow-up deletes what moved and re-exports it from main, and the
  golden test keeps passing without `-u`.
- **New on main**: `tradePortalSlice.ts` (in `_shared`, the slice builder), `tradePortalState.ts`
  (slice → the prototype's shapes, through `gcProjectFromRows`), and `tradePortalSubmit.ts` (each
  `trade*` action → its kind and body). Its test fails when a `trade*` action has no kind and is
  not on the list of kinds that wait, with their lane.

## The functions

**Edge functions** (each gets a `verify_jwt = false` block in `config.toml`, a section in
`docs/EDGE_FUNCTIONS.md`, and a deploy by the lead):

| Function | PR | What it does |
|---|---|---|
| `gc-trade-portal` | P1b | `GET ?t=<token>[&preview=1]`. Service role. Resolves the link (raw token, then hash; off → 404 with the key `linkOff`). Counts the view, reads the company's rows in about eight queries, and returns `tradePortalSlice(rows)`. A sample token returns the sample slice. |
| `submit-gc-trade-portal` | P2b, then a case per kind | `POST {token, kind, …}`. Service role, honeypot, token length check, and 10 free-text writes a link an hour (`tooMany`). Resolves the link to its company, then calls that kind's `gc_trade_<verb>(company_id, …)`. A sample token answers `ok` and writes nothing. |
| `gc-trade-email` | P3 | `POST {companyId, kind, key, projectId, subject, lines, lang}` with a staff JWT (office roles, dev until the door). Recipients from the company record by the kind's group, the link, the frame, Resend with the PM as Reply-To, `file:` for the sent copy, and a `gc_trade_messages` row. Returns `{companyId, messageId, emailSendLogId}`. |

**`gc-trade-email`'s contract** (agreed with Helper 6 for step 7, 2026-10-08):

- **Request:** `POST {companyId, kind, key, projectId | null, lang, subject, lines}` with a staff JWT. `lines` is `Array<string | {title?: string, items: string[]}>`: a string is a paragraph, and an object is a list under its title, such as an invitation's scope lines and what it leaves out (agreed with Helper 2, 2026-10-08).
  - `lines` come without the greeting. The function trims each string and drops empty ones, and it stores `lines` as sent in `gc_trade_messages.lines`, a JSON list. The server writes "Hello Dana," or "Hello Marcus and Dana," from the recipients it picks. It adds the portal link as a button.
  - `key` is the prototype's message key and the dedupe key, unique per company. A plan set's is `${projectId}:plans:${rev}`.
  - `lang` comes from `tradeMailLang(company.lang)` in `src/lib/gc/tradeEmail.ts` (P3-a, v2.4936), not `portal.ts`, so the lifted kernel takes no pin. That returns `en` while Spanish is held (decision 8), and the server refuses `es` then.
  - The words are built with `pt()` exactly as `portalMessages` builds that kind. An invitation comes from `inviteMessage(project, pkg, invite, partner, lang)`, split out of `portalMessages` on the spike and lifted in P1b-i, so the Ask window previews an invite it has not written yet.
- **Calls:** one company a call, any number in parallel.
- **Response:** `200 {companyId, messageId, emailSendLogId, to}`.
  - A repeated key returns the first send's ids and `already: true`, and sends nothing.
  - No email for anyone in the group or the main contact: `422 noEmail`, no row.
- **Errors:** `{error: key, detail?}`. They are `400 badRequest`/`spanishHeld`, `401 signIn`, `403 officeOnly`/`readOnly` (read-only users and digital twins too), `404 notFound`, `409 notOnProject`, `422 noEmail` and `502 sendFailed`.
- **A Resend failure** writes no `gc_trade_messages` row. `email_send_log` keeps it.
- **One frame builder**, `_shared/gcTradeEmail.ts` (`buildGcTradeEmail`), is read by the function and by What customers see's sample. Every kind shares one journey step.

**SQL functions** (`gc_trade_*` are service-role only; the office's are dev-only until the door):

| Function | Owner | PR |
|---|---|---|
| `mint_gc_trade_portal_link(company_id, rotate)`, `revoke_gc_trade_portal_link(company_id)` | Portal | P1a |
| `gc_trade_got_it`, `gc_trade_set_lang`, `gc_trade_add_person`, `gc_trade_remove_person`, `gc_trade_set_gets` (each holds "every group still goes to someone", and a removed person's groups go back to the main contact, as the reducer does) | Portal, on B1's tables | P2a |
| `gc_trade_open_plans` (`seen_rev`, status opened), `gc_trade_quote_day`, `gc_trade_submit_quote`, `gc_trade_confirm_quote`, `gc_trade_answer_lines`, `gc_trade_decline` (append-only quotes, a lost or awarded-away ask refused) | Portal, on B1's tables | P2a |
| `gc_trade_ask_question` (the company must be on the package; the closing-day rule `gc_record_question` keeps) | Portal, on New project's table | P2a |
| `gc_back_charge`, `gc_keep_back_charge`, `gc_drop_back_charge` (office, under RLS), `gc_trade_answer_back_charge`, `gc_trade_ask_change` | Portal | P4a |
| `gc_trade_vetting_form`, `gc_trade_coi`, `gc_trade_w9` (on B6's `person_contract_documents` rows; the W-9 keeps last-four hints only; the last two call `gc_keep_promises`) | Portal | P5b |
| `gc_trade_punch_fixed`, `gc_trade_submittal_send`, `gc_trade_rfi_ask`, the SOW reports, `draw_ask`, `pay_app`, `final_pay_app`, `unconditional_waiver`, `gc_trade_sign_change` | Building | U3 to U6 |
| `gc_trade_answer_dates`, `gc_trade_say_late`, `gc_trade_keep_day`, `gc_trade_set_crew_count`, `gc_trade_mark_lookahead`, `report_part` | Schedule | PRs 13, 14, 16 |
| Signing the master agreement and a statement of work (a `/contract/accept` token for the company's own unsigned row, as the sub portal's `sign_link`; signing calls `gc_keep_promises`), `send_sov`, `see_bid_tab` | Board's tables, the kind is the Portal's | after B5 and B6 |

## The 37 trade actions, kind by kind

| Prototype action | Kind | PR | Waits on |
|---|---|---|---|
| `tradeOpenPortal` | `got_it` | P2 | B1 |
| `tradeSetLanguage` | `set_lang` | P2 | B1 |
| `tradeAddPerson`, `tradeRemovePerson`, `tradeSetGets` | `add_person`, `remove_person`, `set_gets` | P2 | B1 |
| `tradeOpenPlans` | `open_plans` | P2 | B1 |
| `tradePromise` | `quote_day` | P2 | B1 |
| `tradeSubmitBid`, `tradeConfirmBid`, `tradeAnswerLines`, `tradeDecline` | `submit_quote`, `confirm_quote`, `answer_lines`, `decline` | P2 | B1 (the file waits on P5a) |
| `tradeAskQuestion` | `ask_question` | P2 | main |
| `tradeSignMsa`, `tradeSignSow`, `tradeSendSov` | `sign`, `send_sov` | P2c | B6 |
| `tradeSeeBidTab` | `see_bid_tab` | P5e | B5 |
| `tradeAnswerBackCharge`, `tradeAskChange` | `answer_back_charge`, `ask_change` | P4 | P4a, O1 |
| `tradeUploadCoi`, `tradeSignW9`, `tradeVettingForm` | `coi`, `w9`, `vetting_form` | P5b | B6, P5a |
| `tradeFixPunchItem`, `tradeSendSubmittal`, `tradeAskRfi` | `punch_fixed`, `submittal_send`, `rfi_ask` | P5c | U3, U4, U5 |
| `tradeReport`, `tradeRequestDraw`, `tradeSendPayApp`, `tradeSendFinalPayApp`, `tradeSignUnconditional`, `tradeSignChange`, `tradeSendWarranty` | `sow_report`, `draw_ask`, `pay_app`, `final_pay_app`, `unconditional_waiver`, `sign_change`, `warranty` | P5c | U6 |
| `tradeAnswerDates` | `answer_dates` | P5d | schedule PR 13 |
| `tradeSayLate`, `tradeKeepDay`, `tradeSetCrewCount`, `tradeMarkLookAhead` | `say_late`, `keep_day`, `crew_count`, `mark_lookahead` | P5d | schedule PR 14 |
| `tradeReportPart` | `report_part` | P5d | schedule PR 16 with U6 |

A portal block whose kind is not live yet is hidden on main, not drawn dead.

## The emails, kind by kind

`gc-trade-email` takes any kind in `KIND_GROUP`, so a lane adds a kind by calling it, with no
change to the function. Who presses:

| Kind (group) | Pressed by | Lane |
|---|---|---|
| `invite`, `nudge` (quotes) | The Ask window; until B4, P3's dev panel after `gc_invite_companies` | B4 (day 3), P3 |
| `plans` (quotes, or job once ours) | A new set's email | Helper 6, step 7 (day 4) |
| `answer` (quotes, or job) | An answer recorded in the questions window | P3 (on main's `GcQuestions.tsx`) |
| `bidTab`, `closed`, `vetted`, `preBid`, paper sends | The bid tab, We lost this, vetting, the pre-bid meeting, Send a paper | Board |
| `msa`, `sow`, `start` (contracts, job) | Contracts, Get started | B6 |
| `change`, `paid`, `less` (contracts, pay) | Draws | U6 |
| `changeAsk` (contracts) | A change request turned down or sent to the customer | O3 |
| `backCharge` (pay) | A back-charge charged, kept or dropped | P4 (Building's screen) |
| `dates` (job) | Tell the trades | Schedule PR 13 |
| `coi`, `startSoon` (pay, job) | Timed: not built until the owner says yes (decision 7) | later |

Each one checks CI the way #4815 had to: `file:` on the send, a `CUSTOMER_SURFACES` sender entry,
a journey step with a sample email that reads the same frame builder, and an answer in
`personJourney.ts`. P3 does this once for `gc-trade-email`. A new kind needs only its key.

## The PRs, in order

Each is cut from `origin/main` once the one before it is in, behind the dev door, with its
release note, fragment, docs and guide, its version and stamp claimed at the cut, and `gh pr merge
<n> --auto`. A migration is pushed by the lead, and the next PR on the lane waits for the types
PR. There is one migration a day, and P3 has none (its table rides in P1a). *Check* is how the lead
sees it work.

0. **P0, the words and the kernels that move now** (no database; day 1, 10-08, on the lead's go).
   It lifts 689 word keys and 70 declarations word for word, plus `quotesWantedOn` and `questionsFor`
   into `questions.ts`, with main's direct tests and the voice test. The spike's follow-up
   re-exports them. *Check:* `lift-same.cjs portal-p0.lift.json` green; `npm test`; the spike's
   golden test passes without `-u`; Helper 1 can lift the seven schedule functions on top.
1. **P1a, the link and the messages table** (migration; cut the hour B1 merges, pushed in the
   lead's next batch, day 2 morning). It adds `gc_trade_portal_links`, `gc_trade_messages`, the two
   office RPCs and the `public_page_views` surface. *Check:* the migration doc's SQL shows both
   tables empty with their policies; a training-mode user's insert is refused; a non-dev's
   `mint_gc_trade_portal_link` is refused; a dev's returns a 64-character token and the same token
   again until `rotate`.
2. **P1b, the portal on real data, read only** (day 2, after P1a's types and B2's kernels). It
   adds `gc-trade-portal`, the slice builder and its "never sees" test, the mapper, the page at
   `/t/:token` (lazy, light, the prototype's components with `dispatch` swapped for the submit
   adapter, presses hidden until P2), and the lifted `portalAsks`, `portalHome` and their callees.
   It also adds Their messages from `gc_trade_messages`, the office's **Their portal** control
   (*Make the link*, *Copy link*, *Make a new link*, *Turn it off*, the status from
   `tradePortalStatus`) in B3's company window, or a dev-only "Trade portals" list on `/gc` if B3
   is not in yet, plus the sample, the surface entry and the journey step. *Check:* on prod, a
   dev makes a link for "Test trade, delete me" (a test company invited with
   `gc_invite_companies` to "GC test project, delete me"); the link opens at 375 px and at a desk
   on the home with the test project under *Asked to quote*, its plans and scope lines; a second
   company's link does not show it; a turned-off link reads *This link is no longer active*; the
   office's preview does not count as a visit.
3. **P2a, the first trade writes' SQL** (migration; day 3 morning). It adds the twelve functions
   on B1's tables and `gc_plan_questions`, reviewed by Helper 2. *Check:* each function run under
   `service_role` inside a transaction that never commits: another company's id is refused in
   plain words; a quote on a declined ask is refused; removing the last person on *pay* hands
   *pay* back to the main contact; a question after the closing day is refused.
4. **P2b, the first presses** (day 3, after P2a's types). It adds `submit-gc-trade-portal` with
   the twelve kinds and the presses unhidden: *Got it*, Español (hidden by decision 8), *Who gets
   our emails*, open the plans, the quote day, the quote form (number, includes, alternates, good
   for, their schedule of values, what it leaves out; no file yet), confirm after a new set,
   answer the lines, pass, and ask about the plans. *Check:* on the test link, the quote day shows
   on the office's Follow up; a quote shows on the Trades tab and Compare; a question appears in
   the questions window as from the test company; a second person ticked for *pay* is kept;
   eleven questions in an hour is refused on the eleventh, in the portal's language.
5. **P3, the emails** (day 3). It adds `gc-trade-email`, `_shared/gcTradeEmail.ts` (the frame,
   English and Spanish), the server's copy of the recipients rule, the sent copy, the surface,
   the journey step and the sample email, and the first callers: `answer` from the questions
   window, and `invite` from P1b's panel until B4's window calls it. `portalMessages` and `paperSendMessages` lift here,
   or its builders lift kind by kind if a callee is late (decision in *Kernels*). *Check:* an
   invitation reaches an inbox the owner names, greeting the people ticked for *quotes*, with the
   link; it reads the same on What customers see; the same press twice sends once; the test
   company's Their messages shows it as sent.
6. **P2c, signing** (after B6). The `sign` and `send_sov` kinds open the company's own unsigned
   master agreement or statement of work on `/contract/accept`. *Check:* the test company signs a
   test agreement, and the company window reads it signed.
7. **P4a, back-charges and change requests' tables and SQL** (migration). *Check:* as P2a, and
   Helper 5's two RPCs write their columns under office RLS.
8. **P4b, their presses and the dashboard** (after P4a's types). It adds the two kinds, the
   portal's *Charges from Click* and *Ask for a change* (no file until P5a), the `backCharge`
   email, and the dashboard's two Needs you lines on real data. *Check:* the prototype's Iron
   Horse $1,250 walk on the test project: charged, disputed in the portal, the Needs you line red
   after 7 days, kept; a change request appears on Owner Billing's list with only "Your part" on
   the trade's side.
9. **P5a, files.** The `file` kind into Drive, and the pickers unhidden. *Check:* a test PDF
   lands in the test project's *Team only → From trades* folder, and its link is on the quote.
10. **P5b, the company's own papers** (after B6; migration). Insurance, the W-9 and the vetting
    form. *Check:* a new test company sends its form and the office approves it; a certificate
    with a date shows on the company window; the W-9's number is never shown.
11. **P5c, Building's kinds**, a case per kind as U3 to U6 land. **P5d, the schedule's kinds**, as
    PRs 13, 14 and 16 land. **P5e, the bid tab** after B5. Each one unhides its block. *Check:*
    each lane's own walk, pressed from the test link.
12. **The door** (Helper 6's pattern). Making a link opens to the office roles, with
    `ACCESS_CONTROL.md`. It ships when the owner says a real trade may get one.

**Day 4 (10-11), a friendly trade on a real link** needs P1b, P2b and P3 in, B4's Ask window (or
`gc_invite_companies` and P3's panel), a real project with a set whose Drive link reads *anyone*,
and the owner's yes to the trade and to the email. The trade opens the link from the invitation,
reads the plans, gives a quote day or a quote, and asks a question, all from a phone.

## Docs each PR touches

`docs/migrations/<stamp>_<slug>.md` for P1a, P2a, P4a and P5b. `docs/EDGE_FUNCTIONS.md` (a section
and a TOC line) for `gc-trade-portal` (P1b), `submit-gc-trade-portal` (P2b, then each new kind),
and `gc-trade-email` (P3). `docs/SUB_PORTAL_ARCHITECTURE.md` gets one line pointing at its company
sibling (P1b). `docs/SENT_COPIES.md` gets the new sent kind (P3). `docs/ACCESS_CONTROL.md` gets the
public route and the dev-only RPCs (P1b), and the door later. `PROJECT_DOCUMENTATION.md`,
`docs/twins/APP_DIRECTORY.md` and `GLOSSARY.md` (trade partner, trade portal, back-charge, change
request) get edits at P1b and P4b. Help guides, in plain words: "share a trade partner its portal"
(P1b), "see what a trade partner sends from its portal" (P2b), "email a trade partner from GC mode"
(P3), "charge a trade partner for cleanup or damage" and "answer a trade partner's change request"
(P4b). `NEW_PROJECT_REAL_BUILD.md` (step 7 through `gc-trade-email`; `gc_companies`, not `gc_partners`)
and `BUILD_MAP.md` (`gc_companies`) were amended on 2026-10-07 at the lead's ask.

## The owner's calls this plan raises

1. Decisions 1 to 12 above, each at its default unless he says otherwise. The ones he will notice:
   the `/t/` address with no short one until the GC entity is named (1), Spanish held until a
   native speaker reads it (8), and no automatic emails to trades yet (7).
2. **The friendly trade for day 4**: which company, and his yes to email it.
3. **An inbox for the checks**: an address he names on "Test trade, delete me" for P3's check.
4. **The test rows** this lane adds on prod: the test company, its people, link, invite, quote,
   question, messages and back-charge, all named "… test …, delete me" (call 13 covers the sweep).

## Is this the best we can do?

Three ways it could be better:

1. **The server builds the view.** If Helper 1's decision 10 proves an edge function can bundle
   `src/lib/gc`, the read function could return `portalHome` itself. The payload would be smaller,
   the rules would sit on the server, and the "never sees" test would read the view instead of a
   slice. *My pick: not now.* The slice and its test are the boundary either way, and moving to a
   built view later changes only the read function and the page's loader.
2. **Know who read the email, not only who opened the portal.** `resend-webhook` already logs
   delivered and opened. Joining it through `gc_trade_messages.email_send_log_id` can show "opened
   the invitation Tue, never opened the portal" on Follow up, which is a sharper nudge than "never
   opened". *My pick: yes, in P3, since it is a read of what the table already holds.*
3. **One link a person, not a company.** A company's bookkeeper and its estimator would each have
   their own link, and we would know who did what. The owner chose one link per company, and
   people are named for emails instead. *My pick: keep his call.* The submit function records
   `added_by` and the kind's time, and a per-person link can come later on the same table with a
   `person_id` column.

## Status

Planned 2026-10-07 by Helper 3 on `spike/portal-plan` (from `origin/spike/gc-mode` at e8f61a36f).
The seams were agreed the same evening with Helpers 1, 2, 4, 5 and 6 (*Agreed with the other
lanes*).

Built as of 2026-10-08, each behind the dev door:

| PR | What | State | Spike follow-up |
|---|---|---|---|
| P0 #4857 (v2.4840) | The words and 70 kernels | merged | `spike/portal-p0-follow`, pinned |
| Words #4935 (v2.4904) | The set email's two lines and the voice scan | merged | `spike/portal-voice-follow`, pinned |
| P1a #4880 (v2.4857) | `gc_trade_portal_links`, `gc_trade_messages`, the slice builder | merged, migration `20261008050000` pushed | none (no lift) |
| P1b-i #4938 (v2.4905) | The portal's reads and the slice to state mapper | merged | `spike/portal-p1b-i-follow`, pinned, with `tsconfig.gc-main.json` |
| P1b-ii-a #4946 (v2.4916) | `gc-trade-portal` and its sample | merged, deployed 2026-10-08 | none (no lift) |
| Fix #4950 (v2.4919) | `inviteMessage` with no size note | armed | none (the spike re-exports it) |
| P1b-ii-b (v2.4920) | The page at `/t/<link>` and **Trade portals** on `/gc` | PR next | none expected |

The deploy was probed on prod the same day. `?t=sample` answers 200 with Sample Electric Co.'s slice. An
unknown 64-character token answers `{"error":"linkOff"}`.

**Their portal** sits on its own dev pill, **Trade portals**, beside Trade partners and Follow up, because the
company window was not on main yet (decision on P1b above). It moves into the company window once the Board's
B3-c lands there. Next on the lane: P2a, the first trade writes' SQL.
