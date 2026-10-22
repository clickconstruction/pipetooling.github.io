# Build plan — the walk kit (punch list #142)

*Written 2026-10-21 for a session on another machine to build from this folder alone. Everything
here was read from `main` at v2.5722 (#5977) and, where it says so, from prod through the Supabase
connector the same day. Verify a line before leaning on it if `main` has moved. The decisions and
the step-by-step walk are in `README.md` beside this file; read it first.*

---

## 0. Read this first

### 0.1 What you are building

| PR | What | Size | Depends on |
|---|---|---|---|
| 0 | dev-login reads every page of accounts | S | nothing; ship first |
| 1 | Our own address or number is a person only when the kit's contact carries it (both readers) | M | nothing (v2.5722 is on main) |
| 2 | The tester flag: column, roster view, users policy and guard, `REAL_ACCOUNT` | S + migration | nothing |
| 3 | The tester hides like a sample in every client picker; the Digital twins & samples line | M | PR 2 pushed, its types PR merged |
| 4 | The kit's rows: `walk_setup` and `walk_cleanup` | M + migration | nothing |
| 5 | The tester's three doors, fenced to the kit; the estimate door checks a real account | M | PR 1 (the kernel), PR 2 pushed |
| 6 | The kit is quiet to people: pushes, the assign rule, the morning run | S | PR 1 |
| 7 | The `walk` edge function | L | PRs 3, 4, 5 |
| 8 | The driver (`npm run walk`), the report and the docs; the first run | M | PR 7 |

PRs 0, 1, 2 and 4 touch different files and can be built in parallel, one writer per file set.
Each is its own branch and PR with auto-merge armed (`gh pr merge N --auto`; re-arm after any push
to a queued PR).

### 0.2 The order that must hold

1. **PR 0 before the tester exists.** Prod has exactly 50 auth users, dev-login's one page. The
   tester is the 51st.
2. **PR 2: merge, then `supabase db push`, then deploy the functions.** PR 2 adds
   `is_walk_tester: false` to `REAL_ACCOUNT`, which about thirty functions import. A bundle that
   asks for the column before it exists gets an error from PostgREST, and every sender and fan-out
   in it stops. So the column goes in first, then `npm run check:edge-drift` names the functions
   behind, and `bash scripts/deploy-functions.sh <names…>` deploys them. No tester exists yet, so
   the window between the push and the deploys harms nothing.
3. **PR 3 only after PR 2's push and its `chore(types)` PR.** PR 3's client queries filter on the
   column. The client deploys on merge, and a query on a column the database lacks fails.
4. **The first walk only after § 0.4** (bids@ off two test records) and PRs 0 to 8 deployed. If the
   tester is not there yet, § 4 is the walk with the owner's two presses.

### 0.3 Conventions (the repo's; CLAUDE.md and AGENTS.md apply in full)

- `npm run claim` for each PR's `v2.NNNN`; never "newest + 1". Each feature PR ships
  `src/content/releaseNotes/v2.NNNN.ts` (1 to 4 user-readable bullets, no paths) and
  `docs/recent-features/v2.NNNN.md` (first line `# v2.NNNN — <title> (<date>)`, "punch list #142
  PR n" in it). Never edit the frozen aggregators.
- Drop a session card in the main checkout's `.claude/sessions/active/` and check `npm run sessions`
  before a hot surface (Messages, `gmail-sync`, `quo-webhook`). A hook may refuse the card from a
  worktree; then say so in the PR.
- Kernels first: a pure `.ts` with vitest beside it. Run vitest with
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx vitest run <files>`.
  Edge handlers get a run test on the fake database (`src/test/edgeFakeDb.ts`; the pattern is
  `src/lib/people/realAccountRecipients.run.test.ts`: the handler loaded by path, `serve` and
  `createClient` mocked, `fetch` caught so nothing leaves).
- A mirrored kernel changed or added (`scripts/edge-kernels.mjs` lists them, with `IMPORTERS`) →
  `npm run gen:edge-kernels` in the same commit, or `src/lib/gc/edgeKernels.test.ts` fails CI.
- Before merging: `npm run typecheck && npm run lint && npm test`, and `npm run build` when a glob,
  an asset import or `vite.config.ts` changed. `npm run check:todos` while this folder stands.
- Theme tokens, never raw neutral hexes (`node scripts/theme-tokenize.mjs --check src`); only PR 3
  touches a screen.
- Never `git add -A`. Stage the files by name.
- Docs ship with each PR: `docs/EDGE_FUNCTIONS.md` (a section, and its TOC line, for every new or
  changed function), `docs/migrations/<version>_<slug>.md` for each migration, and
  `ACCESS_CONTROL.md` / `GLOSSARY.md` / `PROJECT_DOCUMENTATION.md` where a role's doors or a term
  change. Amend the sentence that holds a fact; add a row only where the fact has no home.

**Migrations (PRs 2 and 4).**

- Make the file with `supabase migration new <snake_case> </dev/null` (it hangs on stdin in an
  agent's shell otherwise), numbered after `origin/main`'s newest (`git ls-tree origin/main
  supabase/migrations/ | tail`), and claim it: `npm run claim -- --migration <file>`.
- First line `SET lock_timeout = '3s';` (CI-enforced). There is no staging: the DDL runs against
  prod while crews use the app.
- Idempotent and additive: `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`
  then `CREATE POLICY`.
- Neither migration creates a table, so neither ends with the three `apply_*` calls. If a builder
  adds a table after all, it ends with `SELECT public.apply_read_only_write_blocks();`,
  `SELECT public.apply_read_only_stmt_blocks();` and `SELECT public.apply_digital_twin_write_blocks();`.
- A new function gets anon and authenticated EXECUTE by default: revoke by name, then grant.
- A function body you change is copied from the **live** definition (`select
  pg_get_functiondef('public.<name>'::regproc)` through the connector), never from the baseline.
- Applied **only** with `supabase db push`, after the PR is on `main`, from a checkout of
  `origin/main` (a throwaway worktree; a feature worktree would push branch-only files):
  `npm run check:migration-drift`, `bash scripts/db-push.sh`, drift again. Never the MCP's
  `apply_migration` or `execute_sql` for DDL. Then the `chore(types)` PR (`npm run
  gen-types:linked` and `node scripts/build-dev-mcp-catalog.mjs`), and redeploy `dev-mcp` once it
  merges.
- The owner's standing OK of 2026-09-29 covers the push and the function deploys after a merge;
  report what was pushed and deployed.

### 0.4 Before the first walk: bids@ off two test records

Read on prod 2026-10-21: two contacts carry bids@, a test GC company (kind `trade`) and a test
commercial customer (kind `arch`), both made 2026-10-12, one channel each, no lines, no jobs, no
bids, no estimates. `walk_setup` refuses while any contact but the kit's carries the kit's address.

1. **The owner's press:** retype each test record's email in the app (the GC company's card, the
   customer's edit form) to a test address such as `zz-test@example.com`. That fixes the source;
   it does not move the channel.
2. **With the owner's word, a session** deletes the two `contact_channels` rows, one-off, through
   the connector. Read them first with the query below, check each still has no lines, then delete
   by id. Their contacts keep no channel, which is harmless.
3. Run the query again: no rows.

```sql
select ch.id, ch.contact_id, c.kind, c.created_at::date,
  (select count(*) from public.messages m where m.channel_id = ch.id) as lines
from public.contact_channels ch join public.contacts c on c.id = ch.contact_id
where ch.kind = 'email' and ch.key = public.contact_channel_key('email', 'bids@clickplumbing.com');
```

---

## 1. The code as it is (the facts the PRs rest on)

- **Senders.** `quo-send` and `messages-email`: `admin.from('users').select(…).match(REAL_ACCOUNT)`,
  then `if (!who || who.read_only)` refuse, then `caller.rpc('gc_office_team')` (dev, master,
  assistant, controller, estimator). `send-estimate-to-customer`: the estimate is read through the
  caller's RLS, then updated and mailed as the service role, with no account check of its own. It
  answers `accept_url` (the live link with its token) in its JSON. `quo-config` wants a master or
  a dev.
- **The text.** `_shared/quoLines.ts` `sendText` posts `{ content, from: box numberId, to: [number],
  userId? }` to `https://api.quo.com/v1/messages` with the bare key as Authorization;
  `_shared/quoKey.ts` `loadQuoApiKey` reads the vault first. The box is `boxForReply` then
  `sendBox` (`src/lib/messages/boxes.ts`); a customer with no inbound line goes from the team box.
  The first text to a number carries the opt-out line (`src/lib/quo/send.ts` `planSend`).
- **The webhook.** `quo-webhook` `handle`: for a `sent` reading (Quo's delivered, failed or
  undelivered), each of `reading.recipients` is placed with `placeNumber` (→ `quo_place_number`,
  which makes an unknown contact when `contact_for_channel` finds none); for a text or a call,
  `placeEvent` places `reading.external`. `readQuoEvent` (`src/lib/quo/events.ts`): a received
  text's `external` is its `from`; `ourNumberId` is `context.phoneNumberId`; `boxOfInbound` maps it
  to a box.
- **The email reader.** `gmail-sync` `loadTeam` builds `isOurs` (the boxes, the app's sender, every
  staff email) and `isTheBox` (the boxes and the app's sender); `takeOne` calls `leftOut(email,
  isTheBox)` then `emailParty(email, fwd, { isOurs, isTheBox })` (`src/lib/emailIn/leftOut.ts`,
  `emailLine.ts`, v2.5722), then `email_place_address`. It reads each box's Inbox history only
  (`gmailHistory`, `labelId: 'INBOX'`), so a box's sent mail is never read. The app's sender is
  `EMAIL_FROM` (`_shared/emailFrom.ts`; live `team@noreply.clicktooling.com`).
- **The open.** `get-estimate-for-customer` (GET `?token=`) records `public_link_view` with the
  request's user agent (`record_estimate_public_link_view`, a 5-second same-IP-and-UA dedupe) and
  writes the 👀 line once (`writeEstimateThreadLine`). `?preview=1` marks the office's own look and
  counts nothing. The accept page itself is a static page: fetching its HTML counts nothing.
- **Placement.** `contact_for_channel(kind, value)` picks, among contacts carrying the key, the
  channel with the newest line, then the oldest channel. `contact_channel_key` normalizes.
- **Deleting a customer** fires `contacts_keep_thread` (`20261014020000_contact_for_customer.sql`):
  the customer's contacts become `unknown`, keeping their channels and lines.
- **New accounts.** `handle_new_user` inserts a `users` row (role from
  `raw_user_meta_data.invited_role`, else `helpers`); `create-user` then upserts the row with the
  flags, as the service role (`users_guard_privileged_columns` lets a no-JWT writer through; the
  trigger is `BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision,
  team_prospects_access, trial_prospect_id, estimator_prospects_access`).
- **dev-login** (`supabase/functions/dev-login/index.ts`): `adminClient.auth.admin.listUsers()` with
  no page, `.find(email)`, then `generateLink({ type: 'magiclink' })`. The caller verifies the link's
  token with `verifyOtp({ type: 'magiclink', token_hash })`
  (`scripts/mobile-surface-shots.mjs` lines 87–102 are the node recipe).
- **Hiding.** `roster_people` (`20260922001000_roster_people_view.sql`): `is_pay_roster`,
  `is_active_roster`, `account_kind`. Client copies: `activeUsersQuery`
  (`src/lib/people/fetchActiveUsers.ts`) and `isActiveRosterPerson` (`activeRoster.ts`), pinned by
  `rosterRulePin.test.ts`. Hand filters on `is_sample` in thirteen files: `MergeDuplicateDialog.tsx`,
  `ShareColumnDialog.tsx`, `TeamProspectsTab.tsx`, `PeopleUsersTab.tsx`, `usePeopleRoster.ts`,
  `scheduleDispatchHub.ts`, `followUpThreadIo.ts`, `newLaneCardIo.ts`, `assignRuleIo.ts`,
  `seatsCardIo.ts`, `columnShares.ts`, `legalOfficeContactsIo.ts`, and `rosterPeople.ts`'s columns.
  Edge copy: `REAL_ACCOUNT`, held by `realAccountSweep.test.ts` and `scripts/sweep-real-account.mjs`.
- **The office's reads** the report reuses, each taking a client: `supabaseFollowUpIo(client)
  .loadQueue(todayYmd)` (`src/lib/followUp/followUpIo.ts`) with `needsReply` and `weOwe`
  (`queue.ts`) and `newLane` (`newLane.ts`); `loadWaitingOnThem(now, client)` with `waitingOnThem`;
  `loadWentOut(now, client)` with `wentOutRows`; `loadWeekStrip(now, client)` with the tiles in
  `weekStrip.ts`. The estimate text's words: `DEFAULT_LINES.estimate` in
  `src/lib/tellCustomer/tellCustomer.ts`, filled with `fillLine` (`src/lib/quickReplies/blanks.ts`).

---

## 2. The PRs

### PR 0 — dev-login reads every page of accounts (S)

- `supabase/functions/_shared/authUserByEmail.ts`, Deno-free (the `estimateEventLine.ts`
  pattern): `findAuthUserByEmail(listPage, email)` asks `listPage(page)` with `perPage: 1000`,
  page after page, until it finds the address (case-insensitive) or a page comes back short.
- `dev-login` uses it. Nothing else changes.
- Tests: `src/lib/devLoginLookup.test.ts` (found on page 1, found on page 3, not found after a short
  page, case-insensitive, stops on an error).
- Docs: `EDGE_FUNCTIONS.md` § dev-login, one line. Deploy `dev-login`. Verify: the owner's
  dev-login still signs in (`/dev-login?as=1` on a local preview).

### PR 1 — Our own address or number is a person only when the kit's contact carries it (M)

- **`src/lib/walk/kit.ts`** (new, mirrored): `WALK_KIT_KEY = 'walk_kit_v1'`; `WalkKit` (`customerId`,
  `contactId`, `emailChannelId`, `phoneChannelId`, `estimateId`, `email`, `phone`, `testerId`,
  `sharedPhone`, `madeAt`); `parseWalkKit(valueText)` (null for no row or bad JSON);
  `kitCarries(kit, 'email' | 'phone', value)`, comparing as `contact_channel_key` does (an address
  trimmed and lower-cased; a number as E.164 through `toE164`).
- **`src/lib/messages/ownChannels.ts`** (new, mirrored): `ownChannels(boxes, appFrom)` → the own
  addresses (both boxes, the app's sender) and own numbers (both boxes' phones, E.164), and
  `isOwnAddress` / `isOwnNumber`.
- **gmail-sync.** `loadTeam` reads `walk_kit_v1` once per run. `isOurs(a)` and `isTheBox(a)` answer
  false when `isOwnAddress(a) && kitCarries(kit, 'email', a)`. Nothing else in `leftOut` or
  `emailParty` changes. In `takeOne`, when the sender is an own address the kit carries and
  `email_place_address` answers a contact that is not `kit.contactId`, the message is passed over
  with a log line and no label, so the next run tries again.
- **quo-webhook.** One pure helper beside the kernels, `numberPlan(number, own, kit)` →
  `'place' | 'skip'`. `handle`'s sent branch skips a recipient that is our own and not carried
  (a sent event whose every recipient is skipped answers *ignored: our own numbers*);
  `placeEvent` throws `Ignored('our own number, the kit does not carry it')` for a text or a call
  whose `external` is our own and not carried. A carried number is placed through `placeNumber` as
  today; a placement that is not `kit.contactId` is ignored and logged.
- **Tests.** `src/lib/walk/kit.test.ts`; `src/lib/messages/ownChannels.test.ts`;
  `leftOut.test.ts` and `emailLine.test.ts` gain the three cases (from bids@ while the kit carries
  it: taken, in; from bids@ with no kit: left out; from the app's sender while the kit carries
  bids@: left out); a run test of `quo-webhook` on the fake database feeding the four events of
  the walk (README steps 3 and 6: delivered to the bids number, its mirror, received from the bids
  number, its mirror) asserts two lines on the kit's contact and no contact made, and with no kit,
  the same four events make no contact either.
- Add both kernels to `scripts/edge-kernels.mjs`, run `npm run gen:edge-kernels`.
- **Docs.** `EDGE_FUNCTIONS.md` § gmail-sync and § quo-webhook; `MESSAGES_ARCHITECTURE.md`'s email-in
  and channels paragraphs; `GLOSSARY.md` *Walk kit*.
- **Deploy** `gmail-sync`, `quo-webhook`, then whatever `npm run check:edge-drift` names (the mirror's
  importers).
- **Verify, and answer the unknown.** No kit exists, so nothing changes for real mail. Then the
  owner texts *walk check* in Quo's app from the bids number to the company number. Read
  `quo-webhook`'s log lines for that minute with `query_logs`, and run § 5's stray check over the
  minute. A `message.received` ignored as our own number means Quo delivers inside the workspace;
  nothing at all means it does not, and § 4's fallback carries the text leg. Before PR 1, the same
  text would have made two Who is this? contacts, so never send it earlier.

### PR 2 — The tester flag (S + migration)

**Migration** `<stamp>_users_is_walk_tester.sql`:

1. `SET lock_timeout = '3s';`
2. `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_walk_tester boolean NOT NULL DEFAULT false;`
   with a `COMMENT` (a constant default is a catalog change, so the lock is brief).
3. `users_guard_privileged_columns`: the live body plus one check, `IF NEW.is_walk_tester IS DISTINCT
   FROM OLD.is_walk_tester THEN RAISE EXCEPTION 'The walk kit sets this flag' …`; the service role
   still passes by the function's no-JWT early return. Recreate the trigger with `is_walk_tester`
   added to its `UPDATE OF` list. Read the `users` INSERT policies: if any lets a signed-in user
   insert a row, add a restrictive `WITH CHECK (NOT is_walk_tester)`.
4. `roster_people`: `CREATE OR REPLACE VIEW` from its newest definition. Both rollups gain `AND NOT
   COALESCE(u.is_walk_tester, false)`; `account_kind` gains `WHEN u.is_walk_tester THEN 'tester'`
   before the sample line; a new `is_walk_tester` column goes **last** (a replaced view may only
   add columns at the end). Restate its `REVOKE` and `GRANT`.
5. `DROP POLICY IF EXISTS users_walk_tester_hidden ON public.users; CREATE POLICY
   users_walk_tester_hidden ON public.users AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT
   is_walk_tester OR id = (SELECT auth.uid()) OR public.is_dev());`

**In the same PR** (each harmless before the push, since no deployed code reads it yet):

- `REAL_ACCOUNT = { is_sample: false, is_digital_twin: false, is_walk_tester: false }` and its header.
- `isActiveRosterPerson`: `row.is_walk_tester === true` is not a person (undefined reads false).
- Tests: `rosterRulePin.test.ts` (a `TESTER` condition in both rollups; `REAL_ACCOUNT`'s flags still
  equal `is_pay_roster`'s), `realAccountSweep.test.ts` (the rule's regex), `activeRoster.test.ts`.
- Docs: `docs/migrations/<version>_users_is_walk_tester.md`; `ACCESS_CONTROL.md` (who sets the flag,
  who sees the row); `GLOSSARY.md` *Walk tester*.

**After merge:** push, deploy every `REAL_ACCOUNT` importer (§ 0.2 rule 2), then the types PR.

### PR 3 — The tester hides like a sample (M)

- `activeUsersQuery` gains `.eq('is_walk_tester', false)`; the thirteen hand filters gain the same
  (or `!u.is_walk_tester` in memory); `rosterPeople.ts`'s columns gain `is_walk_tester`.
- `src/lib/people/walkTesterSweep.test.ts`: every `.eq('is_sample', false)` under `src/` has
  `.eq('is_walk_tester', false)` in the same chain, and every in-memory `is_sample` filter names
  `is_walk_tester` too (the `realAccountSweep.test.ts` pattern), so a new picker cannot forget it.
- `gmail-sync` `loadTeam` reads staff with `.eq('is_walk_tester', false)`.
- Settings → System → Digital twins & samples (`SampleAccountsCard.tsx` or its page): one read-only
  line, *Walk tester · training mode · last walk <day>* (the last walk is `walk_kit_v1.madeAt`, else
  the account's `last_sign_in_at`), or *No walk tester yet*. No button. A render smoke for both.
- Deploy `gmail-sync`.

### PR 4 — The kit's rows: walk_setup and walk_cleanup (M + migration)

**Migration** `<stamp>_walk_kit.sql`: `SET lock_timeout = '3s';` then two `SECURITY DEFINER` plpgsql
functions with `SET search_path = public`, each `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated;
GRANT EXECUTE … TO service_role;`.

`walk_setup(p_tester uuid, p_app_from text, p_phone text DEFAULT NULL, p_shared_phone_ok boolean
DEFAULT false) RETURNS jsonb`:

1. Reads `messages_boxes_v1`. The kit's email is the bids box's address; its phone is `p_phone`, else
   the bids box's phone. Refuses when either is empty, when the two boxes' numbers are the same,
   or when `p_tester` is not a `users` row with `is_walk_tester`.
2. When `walk_kit_v1` names a customer that still exists, answers that kit (idempotent).
3. Refuses, naming each carrier's contact id, kind and record, when any contact carries the kit's
   email, or the kit's phone (unless `p_shared_phone_ok`, the fallback of § 4), or the team box's
   address, the team box's number, or `p_app_from`. These are the rule's conditions: only the kit
   may carry an own address, and nothing may carry the side that sends to it.
4. Makes, in one transaction: a `customers` row (name *ZZ Walk Messages Desk*, type residential,
   `contact_info` with the email and phone, `master_user_id` the company owner, by the same rule as
   the client's `resolveCompanyOwnerUserId`; read it before writing the SQL); its contact (kind
   `customer`, no name, as `contact_for_customer` makes one) and the two channels; a draft
   estimate (`master_user_id` the owner, `created_by` the tester, title *ZZ walk estimate (delete
   me)*, one line of $1.00, `total_cents` 100, `customer_email` the kit's email, valid 14 days).
5. Writes `walk_kit_v1` and answers it.

`walk_cleanup() RETURNS jsonb`, the counts deleted per table, or a refusal that deletes nothing:

1. Reads `walk_kit_v1`; with no row, answers *nothing to clean*.
2. **Refuses** when another contact carries the kit's email or phone (unless the kit recorded
   `sharedPhone`); when a line on the kit's contact sits on a channel that is not one of the kit's
   two (a real person folded in through Who is this?); when the kit's customer has a job, a bid, a
   project, a payment or a portal link; or when any foreign key from a table not on the list below
   points at the kit's customer, contact or estimate with a row (read `pg_constraint` for the
   referencing tables, so a table added later is refused, not cascaded).
3. Deletes, in this order: for the kit contact's lines, `message_attachments` (refuses if one has a
   `bucket_path`: the kit sends no files), `message_promises`, `message_highlights`, then the
   `messages`; then `contact_owed`, `call_tasks`, `nudge_offers`, `nudge_holds`, `nudge_sent`,
   `quick_reply_uses`, `contact_step_skips`, `contact_jobs`, `contact_channels` and the **contact,
   before the customer** (the customer's delete trigger would keep it as an unknown carrying bids@
   and the bids number); then the kit's `estimate_customer_events`, `sent_documents` (by the kit's
   customer or an estimate source), the `estimates`, and the `customers` row; then `walk_kit_v1`.
4. A job on the kit's customer is refused, not deleted (the kit books none): delete it in the app
   with **Delete job**, which runs `migrate_job_ledger_costs_and_delete`, then clean up again.
5. Keeps: the tester account (the next walk reuses it), `email_send_log` (the record of real sends),
   the mail in Gmail and the texts in Quo.

**Tests.** `scripts/pgtest-walk-kit.sh` with `npm run test:pg:walk-kit` on the local full-schema bed
(copy `scripts/pgtest-combined-copies.sh`): setup twice makes one kit; setup refuses a second
carrier of bids@, a carrier of the team number, and the same number on both boxes; cleanup deletes
only the kit's rows while a real customer beside it, with a line, an estimate and a sent copy,
keeps every row; cleanup refuses a folded-in line and an unknown foreign key; after cleanup no
contact carries bids@ or the bids number. Docs: `docs/migrations/<version>_walk_kit.md`.

### PR 5 — The tester's three doors, fenced to the kit (M)

- **`src/lib/walk/kitDoor.ts`** (new, mirrored): `kitDoorVerdict(who, kit, target)` → `{ ok: true } |
  { refused, words }`. A caller who is not a walk tester gets `{ ok: true }` (the door's own rules
  apply). A walk tester is let through only when the kit exists and the target is the kit's: the
  channel is `kit.emailChannelId` or `kit.phoneChannelId` on `kit.contactId`, the estimate is
  `kit.estimateId` and its `customer_email` is `kit.email`. The words, plainly: *The walk tester
  sends to the walk kit only.*
- **`quo-send`**: read the caller's row without the match; a walk tester (`is_walk_tester`, not a
  sample, not a twin) goes to `kitDoorVerdict` before the office check and passes the `read_only`
  refusal only through it; everyone else keeps `REAL_ACCOUNT` and the `read_only` refusal as today.
  Job Mode refuses the tester.
- **`messages-email`**: the same; files refused for the tester.
- **`send-estimate-to-customer`**: the same caller read. A real account that is not read-only sends
  as today; a walk tester only at the kit; a sample, a twin or a training account is refused
  (README found item 4).
- **Tests.** `kitDoor.test.ts`; run tests of the three handlers on the fake database: the tester at
  the kit goes, the tester at a real contact or estimate is refused with the words, a sample and a
  training account are refused, a real office account is unchanged.
- Regenerate the mirror; deploy `quo-send`, `messages-email`, `send-estimate-to-customer`. Docs:
  `EDGE_FUNCTIONS.md`, one line in each section; `ACCESS_CONTROL.md` the tester's doors.

### PR 6 — The kit is quiet to people (S)

- `src/lib/messages/notifyPlan.ts` (mirrored): a line on `kit.contactId` pushes the real dev accounts
  alone; never the holder, the office's wait push or the after-hours push.
- The assign rule (`src/lib/messages/assignRule.ts`) leaves the kit's contact unassigned.
- `messages-nudge-dispatch` skips the kit's contact in the morning run.
- `messages-notify` and the morning run read `walk_kit_v1` once per run.
- Tests: `notifyPlan.test.ts`, `assignRule.test.ts`, the morning run's kernel test. Regenerate;
  deploy `messages-notify`, `messages-nudge-dispatch` and what `check:edge-drift` names.

### PR 7 — The walk edge function (L)

`supabase/functions/walk/index.ts`; `[functions.walk] verify_jwt = false` in `supabase/config.toml`.
POST `{ action, … }`, gated by `X-Dev-Login-Secret` equal to `DEV_LOGIN_SECRET` (the secret
`dev-login` already holds; 401 otherwise). Every answer carries ids, times and words, never a
token, a key or a whole link (a link shows as its last four characters).

| Action | What it does |
|---|---|
| `setup` | Makes the tester when missing: `auth.admin.createUser({ email: 'walk-tester@walk.pipetooling.local', email_confirm: true, user_metadata: { invited_role: 'assistant', name: 'ZZ Walk tester' } })`, then upserts the `users` row (`role` assistant, `read_only` true, `is_walk_tester` true) as `create-user` does. Then `walk_setup(tester, EMAIL_FROM's address, phone, sharedOk)`. With `fallback: true`, the phone is the owner's own (`users.phone` of the account the caller names, the dev-login identity) and `sharedOk` is true. Answers the kit and the tester's email. |
| `open` | As bids@ (Gmail, `googleServiceToken(GOOGLE_SERVICE_ACCOUNT_JSON, GMAIL_SCOPES, bids address)`): finds the estimate email from the app's sender for the kit's estimate (`gmailSearch`, newer than a day). With none yet, answers `{ arrived: false }`. With one, GETs `get-estimate-for-customer?token=…` from its link with a browser's `User-Agent`, never `preview=1`. Answers when the email arrived, its Gmail and RFC Message-ID, the link's last four, and the open's status. |
| `reply-email` | As bids@: `users.messages.send` (the `raw` RFC 2822 message, base64url) To the team box's address from Settings, Subject `Re: <the estimate's subject>`, `In-Reply-To` and `References` the estimate email's Message-ID, in its Gmail thread. Answers the sent Message-ID and time. |
| `text` | `{ words }`: Quo's send, from the bids box's number id to the team box's number, the same request `sendText` makes, with the vault's key (`loadQuoApiKey`). Check quo.com/docs/2026-03-30 for whether the versioned path wants `Quo-Api-Version: 2026-03-30` on this call, as `quoKey.ts`'s reads send it. Refused in fallback mode (the owner texts by hand). Answers Quo's message id and time. |
| `seed-old` | One `out` text line on the kit's contact, three days old, `who_text` *ZZ walk seed*, so Waiting on them can be read in a same-day walk. Optional. |
| `cleanup` | `walk_cleanup()`; answers its counts or its refusal. |

Tests: a run test on the fake database with `fetch` caught (Gmail, Quo, the estimate function): the
gate refuses a wrong secret; each action's request has the shape above; the tester is made once;
**no answer contains any value from the function's env**, checked by scanning the answer JSON.
Docs: `EDGE_FUNCTIONS.md` § walk and its TOC line. Deploy: `bash scripts/deploy-functions.sh walk`.

### PR 8 — The driver, the report and the docs (M)

**`scripts/walk/run.ts`** under vite-node (as `scripts/claim-version.ts` runs), `npm run walk`.
Flags: `--keep` (no cleanup), `--owner-presses` (§ 4), `--fallback-phone` (§ 4), `--answer` (README
step 8), `--cleanup-only`.

It reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DEV_LOGIN_SECRET` from the main
checkout's newest `.env.local` and prints none of them. Every wait polls every 15 seconds and ends
after its limit with what it saw. Cleanup runs in a `finally`.

1. `walk setup`.
2. Signs in as the tester: `dev-login` (PR 0) for its email, then `verifyOtp`. The session lives
   in memory only, never on disk.
3. **The estimate email**: POST `send-estimate-to-customer` `{ estimate_id, customer_email: kit.email,
   public_origin: 'https://clicktooling.com' }` with the tester's JWT. Keeps `accept_url` in memory.
4. **The estimate text**: `DEFAULT_LINES.estimate` filled with `fillLine` (the kit's first name,
   *ZZ Walk tester* as `{me}`, the job, the amount, the link), POST `quo-send` `{ contactId,
   channelId: kit.phoneChannelId, body }` with the tester's JWT.
5. **The open**: `walk open` until the email has arrived (3 minutes), then wait for the 👀 line.
6. **The email reply**: `walk reply-email` *Can you do it Thursday?*; wait for the line on the kit's
   thread, box team (3 minutes; the reader runs every minute).
7. **The text reply**: `walk text` *Thursday works*; wait for the inbound line and for the step 4
   text's ✓ delivered (3 minutes).
8. **STOP, then START**: `walk text` *STOP*; wait for the team box's stop on the kit's number
   (`opted_out_by_box`), then *START* and wait for it to clear.
9. With `--answer`: POST `messages-email` as the tester to `kit.emailChannelId`; wait 3 minutes and
   assert one out line and no second line.
10. **The office's view**, as the tester's client: `loadQueue` then `needsReply` and `newLane` (which
    lane ZZ Walk is in, and who has it); `loadWaitingOnThem` then `waitingOnThem` (after
    `seed-old`, the row is there before the reply and gone after it); `loadWentOut` then
    `wentOutRows` (the text ✓ delivered, the email opened); `loadWeekStrip` then the tiles, twice,
    with and without the kit contact's lines and the kit's estimate, printed as the kit's
    difference.
11. **The stray check**: no contact made since step 1 carries an own address or number (§ 5).
12. **The report**, printed and written to `tmp/walk/<stamp>.json` (the PR adds `tmp/walk/` to
    `.gitignore`): one row per step with sent at, landed at, where (line, box, lane) and ok; then
    the lanes, Went out, the strip's difference, the stray check, Quo's answers, and cleanup's
    counts. A step that held says why and what it waited for.

**Docs.** `docs/WALK_KIT.md` (what it is, how to run it, what it touches and leaves, the fallback,
§ 5's SQL); `docs/MESSAGES_ARCHITECTURE.md` § Testing it, the live bullet points to the kit; one row
in `docs/README.md`'s index; `to-dos/messages-desk/BUILD_PLAN.md` § 0.5's last bullet and § 3's
opening say the walk now runs with the kit (Route B stays the fallback). Then **the first run** is
the done test. Delete this folder in the PR after the first green run, or in a small follow-up.

---

## 3. The first run (done looks like)

From a fresh session on any machine with the repo and its `.env.local`: `npm run walk`. It touches
only bids@, team@'s inbox (one reply), the bids number and the company number. It prints every step
with its times, the three lanes, Went out and the strip's difference, finds no stray contact, and
cleans up to zero rows. Then: `walk_kit_v1` is gone, § 5's stray query is empty, and the
`gmail_sync_state` rows still read healthy.

## 4. If the tester is not there yet: the owner's two presses

When PRs 2, 3 or 5 are not deployed, or the tester account is missing, `npm run walk --
--owner-presses` runs the same walk and stops at the two sends. It needs PRs 0, 1, 4, 7 and 8, and
`walk setup` makes the kit with the owner as the estimate's maker instead of the tester.

1. The session runs it; the script prints what to press and waits.
2. **The owner** opens the customer *ZZ Walk Messages Desk*, opens its draft estimate, presses
   **Send**, and in the **Tell the customer** sheet presses **Send both**.
3. The script sees the estimate turn sent and the text line appear, and does the rest: the open,
   the email reply, the text reply, STOP and START, the read and cleanup. Its reads sign in as the
   dev-login identity, read only.

**If Quo does not deliver between its own numbers** (PR 1's verify, or step 7 times out with no
inbound): `npm run walk -- --fallback-phone`. ZZ Walk's phone is the owner's own; the estimate text
goes there; the script asks the owner to text *Thursday works* back, and later *STOP* and *START*,
from that phone. Those replies are the owner's presses. Cleanup removes the kit's channel only; the
owner's own Our team contact keeps the number.

## 5. The report's SQL, for a session's Supabase connector

Read-only, through `execute_sql` (psql over the pooler is refused by the classifier in a session).
Take the ids from the first query.

```sql
-- The kit
select value_text from public.app_settings where key = 'walk_kit_v1';

-- ZZ Walk's thread, in order
select at, channel, direction, mailbox, delivery, who_text, left(body, 60) as words
from public.messages where contact_id = '<contactId>' order by at, id;

-- The opt-out marks on the kit's number
select opted_out_at, opted_out_by_box from public.contact_channels where id = '<phoneChannelId>';

-- The estimate and what the customer did
select status, sent_at from public.estimates where id = '<estimateId>';
select event_type, occurred_at, user_agent from public.estimate_customer_events
where estimate_id = '<estimateId>' order by occurred_at;

-- The stray check: contacts made since the run began that carry an own address or number
select c.id, c.kind, ch.kind, ch.created_at
from public.contacts c join public.contact_channels ch on ch.contact_id = c.id
where c.created_at >= '<run start>' and c.id <> '<contactId>'
  and ch.key in (
    public.contact_channel_key('email', 'team@clickplumbing.com'),
    public.contact_channel_key('email', 'bids@clickplumbing.com'),
    public.contact_channel_key('email', 'team@noreply.clicktooling.com'),
    public.contact_channel_key('phone', '+15129942774'),
    public.contact_channel_key('phone', '+17373009478'));

-- The readers' health
select mailbox, last_run_at, last_ok_at, last_error, last_taken from public.gmail_sync_state;
```

With `query_logs`, over the run's window: `quo-webhook`'s and `gmail-sync`'s lines in the
`function_edge_logs` source. The *ignored: our own number* lines are the mirrors of steps 3 and 6.

## 6. What stays after cleanup

Nothing in the app's tables. Outside them: `email_send_log` and Resend's log (the record of real
sends), the estimate email in bids@'s Inbox with no label, the reply in bids@'s Sent and in team@'s
Inbox with the label *In ClickTooling*, the texts in Quo's history on both numbers, the edge logs,
and the tester account for the next walk.
