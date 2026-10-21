# Build plan — Messages, worked like a desk (punch list #140)

*Written 2026-10-21 by the session that filed the proposal, for another session (led by another
person) to build. Everything here was read from the code on `main` and on the #139 stack the same
day; verify a line before leaning on it if `main` has moved. The proposal and the mock-up are
beside this file (`README.md`, `mockup.html`); the state table to keep current is README
§ Where it stands.*

---

## 0. Read this first

### What you are building

Nine PRs, smallest first, on `/messages` and the thread. The owner's go (2026-10-21) covers all
nine with the recommended defaults, **as revised in §0.3 below** after the code was read. Build
them in this order; each is its own PR with auto-merge armed; stop whenever the session must and
leave README § Where it stands true.

| PR | What | Size | Base to cut from |
|---|---|---|---|
| 1 | Office hours card (Settings → Phone and texts) | S | `main` |
| 2 | Finish switching Messages on (the card and its line on Messages) | M | the page base (§0.2) |
| 3 | Show: Mine · Everyone (the lens over every lane) | M | the page base |
| 4 | Nudge fills the step's words; a failed text offers Call them / Send it as an email | M | the page base |
| 5 | The last 7 days strip | L | the page base |
| 6 | Answer all | L | the page base, after PR 3 |
| 7 | Log a call (a `log_call` RPC + the Call kind in the reply box) | M + migration | `main` |
| 8 | A lead's doors (Book a visit, Start an estimate) | M | `main` |
| 9 | One front door; the guides | S | after 1–8 |

PRs 1, 7 and 8 touch no file the #139 stack touches and can go in parallel with the page PRs
(separate branches, separate sessions if you like; never two writers on one file).

### 0.2 The page base: where the #139 stack stands

`/messages` on `main` is behind what the mock-up shows. The six additions of punch list #139 are
PRs **#5949 → #5954**, stacked on **#5947 → #5948**, each retargeting to `main` as the one under it
merges. On 2026-10-21 08:00 UTC, #5946 was on `main` and #5947 was in the merge queue. Before
cutting any page PR (2–6):

```bash
gh pr list --repo clickconstruction/pipetooling.github.io --search "punch list #139" --state open --json number,baseRefName,mergeStateStatus
```

- **If #5954 has merged**: cut from `main`. Done.
- **If not**: cut from `claude/press-answers-16-polish` (the top of the stack; it holds the whole
  page) and open the PR with that branch as base; retarget to `main` when the stack lands (the
  app's Auto-fix pings on conflicts; keep the stack's lane/page files, take main's everything
  else). Or wait for the stack — PRs 1, 7 and 8 are a day of work on their own.

The page files the stack changes (don't cut these from `main` while it is open):
`src/pages/Messages.tsx`, `src/pages/Messages.render.test.tsx`, `src/lib/messages/{wentOut,wentOutIo,waitingOnThem,waitingOnThemIo,searchLines,everyone,queuesFold,estimateDoor,estimateDoorIo,thread,load,messagesIo}.ts`,
`src/components/messages/{WentOutToday,WaitingOnThem}.tsx`, `src/components/gc/messages/{ThreadLine,threadSlots}.tsx`,
`src/components/estimates/useEstimateDoorThreadSlots.tsx`, the Messages guides.

### 0.3 The decisions as taken, and the three revisions the code forced

The owner took the recommended defaults (README § The seven decisions). Reading the code changed
three of them; build the revised form and say so in each PR's fragment:

1. **Show has two values, Mine · Everyone, not three.** "Nobody's" inside Needs a reply is empty
   by design: a person nobody holds whose newest line is theirs lands in **New** under "Who has
   it?", and `followUpQueue` takes New's people out of Needs a reply. New already *is* the
   nobody's list. (`src/lib/followUp/queue.ts` `followUpQueue`, `newLane`.)
2. **Log a call is a migration.** A `messages` row with `channel 'call'` cannot be written by a
   signed-in client (CHECK `messages_team_is_noteor_event`: a team-direction row is a note or an
   event; RLS `messages_client_writes_own_team_lines`: clients insert notes and events only). A
   call logged as a note would clear Needs a reply but leave the thread's "Our move" chip wrong
   and be invisible to Waiting on them. So: a SECURITY DEFINER RPC `log_call` writes the call as
   our line (`direction 'out'`), which the existing trigger `messages_move_state` treats as a
   reply, and writes the day they gave as a promise on that line. See PR 7.
3. **The lead's doors need two doors that don't exist.** Add Job has no "open with a name, a
   phone and words" option (`openNewJob(opts)` takes a bid prefill only), and a new estimate
   never takes a customer (`createDraft` in `Estimates.tsx` sets no `customer_id`). Both are small
   and are part of PR 8. "Add to Prospects" has a pure kernel (`src/lib/prospects/leadThread.ts`)
   and **no caller**; PR 8 does not build it. The mock-up's "Who is this? · kept as a lead" chip
   is not an app phrase; the thread shows **Lead:** *name* in the sub-line instead.

Two more facts to carry: **"Call back in Quo" is always disabled** (`FollowUpSections.tsx` ~352),
regardless of the seats — the switch card must not claim the seats turn it on; and the
**after-hours auto-answer is not live** (`afterHoursAnswer()` in `hasRule.ts` has no caller;
`notifyPlan.ts` passes `lastAutoAnswerAt: null`) — the Office hours card says only what is true
(the office hears first after hours; the reply waits for the morning).

### 0.4 The rule on every PR: "is this the best we can do?"

Before filing each PR, answer these in the PR description (two lines each):

1. Does the office reach it in fewer presses than today, on a phone?
2. Is every new sentence plain words (`src/lib/plainWords.ts`: one idea, ≤ 20 words, the
   control's exact name, no dashes, semicolons, parentheses or dot lists inside a sentence)?
3. Does a batch action do what is ready and say what it held and why (never all-or-nothing)?
4. Did we reuse the kernel or shell that already does this (the Sort desk, the reply box, the
   lane reads) instead of a sibling?
5. What did we cut, and is the cut written in the fragment as "not carried"?

### 0.5 Conventions checklist (the repo's; the CLAUDE.md rules apply in full)

- Branch per PR; `npm run claim` for the `v2.NNNN`; drop a session card in the main checkout's
  `.claude/sessions/active/<branch>.md`; `npm run sessions` before touching a hot surface.
- Each PR ships `src/content/releaseNotes/v2.NNNN.ts` + `docs/recent-features/v2.NNNN.md`
  (first line `# v2.NNNN — <title> (<date>)`, "punch list #140 PR n" in it), the guide
  amendment, and the doc amendments named per PR below.
- Kernels first (pure `.ts` + vitest), then the component with a render smoke
  (`renderWithProviders` from `src/test/renderSmokeMocks.tsx`, `// @vitest-environment jsdom`,
  `vi.mock('../../lib/supabase', … makeSupabaseStub())`). Run vitest with
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx vitest run <files>`.
- Theme tokens, never raw neutral hexes (`node scripts/theme-tokenize.mjs --check src`).
- A mirrored kernel changed (`scripts/edge-kernels.mjs` lists them: `lib/messages/thread.ts`,
  `hasRule.ts`, `boxes.ts`, `followUp/followUpTypes.ts`, …) → `npm run gen:edge-kernels` in the
  same commit, or `src/lib/gc/edgeKernels.test.ts` fails CI (it did on #5949).
- Narrow typecheck when the Mac is crowded: a scratch `tsconfig.narrowN.json` over the changed
  files (`node node_modules/typescript/bin/tsc -p …`), full `tsc -b` on CI.
- Merge: `gh pr merge N --auto` once the base is `main` (it refuses other bases); a CLEAN PR
  that sits unqueued → GraphQL `enqueuePullRequest`.
- A migration (PR 7 only): `SET lock_timeout = '3s';` first line, numbered from
  `git ls-tree origin/main supabase/migrations/ | tail`, `npm run claim -- --migration <file>`,
  `docs/migrations/<version>_<slug>.md`, applied **only** with `supabase db push` after the PR
  is on `main`. No table is created, so the three `apply_*` calls are not needed.
- Prod sends are the owner's presses (Route B, §3): the session sets up and reads; a human
  presses Send.

---

## 1. The code as it is (the facts the PRs rest on)

Paths are repo-relative. "(16-polish)" = as on `claude/press-answers-16-polish`.

### 1.1 Follow up (the queues)

- `src/components/followUp/FollowUpPanel.tsx` — props `{ me: Teammate; team; onOpenThread(contactId, atMessageId?); say; io?: FollowUpIo; enabled?; clauses?; nudges?; seeTheirPage?; planQuestions?; onCount?(count); narrow?(queue, contacts) => FollowUpQueue; todayYmd?; nowIso?; sortIo?: NewLaneCardIo }`.
  Loads through `useFollowUpQueue` (`src/hooks/useFollowUpQueue.ts`) → `{ queue, contacts, lines, loading, problem, pressing, reload(), press(name, run) }`; `useMessagesLive` re-reads on live changes. `drawn = narrow ? narrow(q.queue, q.contacts) : q.queue` feeds both `FollowUpSections` and the Sort desk. `onCount` reports `q.queue.count` **before** `narrow`.
- `src/components/followUp/FollowUpSections.tsx` — order: New (header `action` = Sort all) → Needs you (only when > 0) → Needs a reply → We owe them (+ call tasks) → nudges. `Section({ title, note, action?, children })` already takes an `action` node (used by New only). Row views: `NewRowView`, `BackRowView`, `PortalRowView`, `ReplyRowView`, `OwedRowView`, `CallRowView`, all through a private `Row` that draws `WhoHasItPill`. `ReplyRowView`: pill `Our move · {agoWords(row.waitingSince)}`, snippet from `lines.get(row.landOnId)`, acts from `row.acts` (`'Reply' | 'Who is this?'` → `openThread(contactId, landOnId)`; `'No reply needed'` → `io.setState(id,'done')`; `'Remind me Monday'` → `setState(id,'snoozed')`; `'Call back in Quo'` disabled always). `KIND_WORDS` (~67) has no `lead` entry (a lead's sub-line is empty).
- `src/lib/followUp/queue.ts` — `NeedsReplyRow { contactId; landOnId; waitingSince: ISO|null; callBack; offers; acts }` (no kind, words, channel: join `contacts` and `lines`); `needsReply(contacts, messages, heard, todayYmd)` keeps `stateToday === 'waiting'`, skips a customer whose newest line came through the portal, sorts oldest `waitingSince` first; `followUpQueue(all, passThrough)` removes New's people from Needs a reply and counts each person once. Who-has-it words: `hasPillWords`, `hasToast`, `takeItWords`, `holdCount`. `stateMoveOf`/`stateAfter` mirror the DB trigger.
- `src/lib/followUp/followUpRows.ts` — `FollowUpContact = QueueContact & { hasUserId: string|null; hasSince; hasHow; jobIds?; defaultJobId?; phone?; trade? }`; `followUpContactOf(c, row, userNames)`. **"Mine" = `contact.hasUserId === me.id`** (the id, never the name).
- Writes: `FollowUpIo` (`src/lib/followUp/followUpIo.ts`) `takeIt(contactId)` → rpc `take_it`; `handTo(contactId, userId|null)` → rpc `hand_to`; `setState(contactId, state)` → rpc `set_state`; `addNote(contactId, body, jobRef, back)` → rpc `add_note`. The DB trigger `messages_move_state` (`supabase/migrations/20261012160000_messages_follow_up.sql:251`) sets `state='done'` and clears `has_user_id` on our `out` line or a `note`; an `in` line sets `waiting`; `event` moves nothing. Nothing writes `has_user_id` on the way in (the assign rule only picks).
- `src/lib/messages/kindPills.ts` — `queueForPill(queue, contacts, pill)` filters every lane by contactId, drops `clauses`, recounts: **the model for the lens kernel**. Messages.tsx composes it in `narrow`.
- The Sort desk: kernel `src/lib/followUp/sortDesk.ts` (`deskStep(lane, skipped, total) → { current, progress, more }`, `skipOne`, `canSortAll`, words `SORT_ALL`, `DESK_SKIP`, `DESK_DONE`; `progress` is hard-coded to New's words); screen `src/components/followUp/SortAllDesk.tsx` (`ResponsiveModalShell` title/`fullScreenKey`/`maxWidthDesktop 680`, `[total]` frozen at open, `skipped`, one card per person with `NewLaneSlot`, Skip for now, "N more after this", the done state with Back to Follow up). Opens from `FollowUpPanel` state `sorting` with `lane={drawn.newLane}`.
- Tests to copy: `FollowUpPanel.render.test.tsx` (`person(id, kind, patch)`, `line(...)`, `has_user_id: 'u-rosa'`, `fakeIo()`, `rowIn('Needs a reply', id)`), `SortAllDesk.render.test.tsx`, `WhoHasItPill.render.test.tsx`, `src/lib/followUp/queue.test.ts` (`describe('who has it')`), `sortDesk.test.ts` (`plainWordsFailures`), `src/lib/messages/kindPills.test.ts` (`queueForPill on the prototype's Friday`, demo people from `followUpDemo.ts` carry `has` names, not ids — add `hasUserId` to the fixture for the lens).

### 1.2 The thread and the reply box

- `src/components/gc/messages/ThreadWindow.tsx` (16-polish, 608 lines) — header row 1: face, `<h2>{name}</h2>`, sub-line `<strong>{capital(kindWord(kind))}:</strong> {company||name}` ("Lead: Lena"), ☎, ⋯, `slots.headerRight` (the `WhoHasItPill`), ×; ~355 `kind === 'unknown'` → blue **Who is this?** (`WhoIsThisWindow`), else the `data-thread-reach` tel/mailto row; ~383 `data-thread-status`: the court chip `courtOf(allLines, contact.id, nowIso, { optedOut })` + `slots.statusRow`; then stamps, `JobsRail`; ~435 `slots.aboveLines(contact, { openWho, showContact })` (the sort card's slot). Slots merge in `threadSlots.tsx` `useThreadSlots()` → `mergeThreadSlots(...)`; the newest example of a slot hook is `src/components/estimates/useEstimateDoorThreadSlots.tsx` (16-polish).
- `courtOf` reads last in vs last out only. **`loadCourtFacts` (`followUpIo.ts:285`) is never called**, so a written promise's "Their move · until …" never shows in the header today.
- Reply box: `src/components/gc/messages/reply/ReplyBox.tsx` `ReplyBox({ contact: Contact; io?: ReplyIo; quickIo?; papersIo?; estimateLinkIo?; job?: { key; name }; billLink?; startWords?: string|null; stageStepIds?; openStrip?; kinds?: readonly ReplyKind[]; attachIo?; loadBoxes? })`. Mounted by `threadSlots.tsx:135` as `box: (c) => <ReplyBox key={'reply:'+c.id} contact={c} />` and by `src/components/jobs/JobCustomerBox.tsx` (outside the thread, `kinds={[kind]}`, wrapped in `MessagesRereadContext.Provider`). The kind row is a `role="radiogroup" aria-label="Reply as"` of `role="radio"` buttons styled by `KIND_LOOK[kind]` (`kindLook.ts`, `Record<ReplyKind, CSSProperties>`). A note saves through `io.addNote(contactId, body, jobKey, back: DayKept|null)` → `supabaseReplyIo` → `FollowUpIo.addNote` → rpc `add_note(p_contact_id, p_body, p_job_kind, p_job_id, p_back_on, p_back_words)`; the "↩ Bring it back on a day…" picker is `NoteBackDay` (`src/components/followUp/NoteBackDay.tsx`, `DayKept { ymd, words }`). `startWords` fills an empty box once (`fillLine(startWords, fills)`); there is **no prop that opens the send window** (`setSending(kind)` is internal to `press()`). Quick replies load only when the strip, Find or `/` is open (`useQuickReplies(qio, me, enabled)`).
- `src/lib/messages/compose.ts` — `ReplyKind = Extract<MessageChannel, 'text'|'email'|'note'>` (`'call'` is already in `MessageChannel`); `REPLY_KINDS` (Text "Send text…", Email "Send email…", Note "Add the note"); `goesOut(kind)`, `canSend`, `boxPlaceholder`, `fromLine`, `countLine`, `sentWords`, `NOTE_ASIDE`, `defaultReplyKind`. Tests: `compose.test.ts` ("the kinds row" pins `REPLY_KINDS`; "plain words" runs every sentence).
- `SendWindow.tsx` (`{ contact, kind: 'text'|'email', body, jobKey, company, io, files?, audience?, hasPortal?, attachIo?, onKind, onClose, onSent(kind, more?) }`): "After this sends: Their move / Our move" at ~397–438 reads `useThreadOwed(contact.id)` → `{ owed, loaded }` and `useOwedAfterSend` (`src/components/followUp/useThreadOwed.ts`) over `owedStore` (`src/lib/followUp/owedStore.ts`); **it renders only when `loaded`**, i.e. `owedStore.open.contactId === contact.id`, published only by `useFollowUpThreadSlots` when `?thread=` is open. Kernel `src/lib/messages/owed.ts` (`afterSendDefault/Words/Result/Tips`, `AfterSendMove`). Writes: rpc `mark_owed`, rpc `owed_sent_done`. "Their move" marks what we owe done; it does not move the court (that is last in vs last out).
- `ReplyIo` (`src/lib/messages/replyIo.ts`): `loadSender()`, `addNote`, `sendEmail(ReplyEmail)` → edge `messages-email`, `sendText(ReplyText)` → edge `quo-send`. The thread re-reads through `MessagesRereadContext` (`useMessagesReread()`).
- Lines: `src/lib/messages/thread.ts` (`ThreadMessage`, `MessageChannel`, `channelWord`, `snippetOf`, `callLength`, `deliveryMark` (16-polish), `pushThreadRow`: `event` → `EventLine`, else `ThreadLine`; `direction 'team'` = yellow tone); `appLines.ts` (`APP_WHO = 'the app'`, `isAppLine` folds app-voiced runs).
- Promises: `message_promises` (`20261012160000_messages_follow_up.sql:145`, keyed by `message_id`; `authenticated` has UPDATE on kind/state/writes/decided_* and **no INSERT**); `runningPromise(lines, contactId, todayYmd)` (`promises.ts:188`); `courtFactsFromRows` (`courtFacts.ts`); `write_down` limits kinds by contact kind (`20261013180000_contacts_seven_kinds.sql:472`). `contact_owed` (one open row per contact; `mark_owed`, `owed_done`, `owed_sent_done`; `contact_owed_guard`).
- The lead path today: New lane → Who is this? → "<name>, a new lead on Prospects" → `nameAsLead` (`messagesIo.ts:434`) → rpc `name_contact(p_contact_id, null, null, 'lead', p_name, null, null)`; sets `contacts.kind='lead'`, writes no `prospects` row. `name_contact` lets a lead be named again only as `customer` (`customers` / `customer_contact_persons`) or to Prospects. `contactForCustomer(customerId)` (`messagesIo.ts:446`, rpc `contact_for_customer`) finds-or-makes a customer's own contact — **do not call it before re-pointing a lead, or you get a second empty contact**; re-point with `nameContact(leadId, { record: { table: 'customers', id }, kind: 'customer' })` (`messagesIo.ts:413`).
- Add Job: `src/contexts/JobFormModalContext.tsx` `useJobFormModal()` → `{ openNewJob(opts?: OpenNewJobOptions), openEditJob, closeJobForm, … }`, `OpenNewJobOptions = { onSaved?, onCreatedJobId?, projectId?, prefillBidId?, prefillDraft?: JobDraft, prefillDraftFrom? }` (the draft needs a bid). `src/components/jobs/JobFormModal.tsx` setters `setCustomerName`, `setCustomerPhone`, `setCustomerEmail`, `setJobName`, `setJobAddress` (~399–413); the `newJobProjectId` effect (~1739) is the prefill pattern. Query door `/jobs?newJob=true` takes no customer fields. Test mock: `vi.mock('../contexts/JobFormModalContext', () => ({ useJobFormModal: () => ({ openNewJob, … }) }))` (`DispatchInboxSection.render.test.tsx`).
- New customer: no shared helper; screens insert `supabase.from('customers').insert(payload).select().single()` (`NewCustomerForm.tsx:227`, `Prospects.tsx:2523`) with `NewCustomerFormPayload = { name, address, contact_info: {phone,email}|null, customer_type, date_met, master_user_id, language? }`, `master_user_id` from `resolveCompanyOwnerUserId(supabase, user.id)`.
- New estimate: `src/pages/Estimates.tsx:780` handles `?newEstimate=true&project=<id>` → `createDraft(projectId, 'estimate', 'deeplink')` (inserts `estimates` with no `customer_id`, navigates `/estimates/<n>` with `state.freshEstimateDraft`). `QuickEstimateWizard.tsx:~558` inserts with `customer_id`. `estimateFreshDraftDiscard.ts` treats a customer id as content (the draft is kept on leave).
- Tests to copy: `reply/ReplyBox.render.test.tsx`, `ReplyFollowUp.render.test.tsx` (`fakeIo(): ReplyIo`, `thread()` from `spineMessagesView()` + `DEMO_NOW`, `OpenThreadContext.Provider`, `vi.mock('./useTextsOn')`, `vi.hoisted` + `vi.mock('../../../followUp/useThreadOwed')`; the note test presses the Note radio and expects `addNote('c-greg', words, 'project:proj-stoneoak', null)`), `ThreadWindow*.render.test.tsx` (`writes(): MessagesWrites`, `slots={...}` replaces `useThreadSlots`; the demo rows in `spineRows.ts` have **no lead** — build one), `compose.test.ts`, `owed.test.ts`, `promises.test.ts`, `courtFacts.test.ts`.

### 1.3 Settings, the switches, office hours

- Settings → Phone and texts (`src/pages/Settings.tsx` ~1505–1518, shown when `canSeePhoneAndTexts(role)`), cards in order: `TextsSwitchSettingsCard` (owner/dev), `PhoneAndTextsSettingsSection` (= the "Who gets a new message" card), `QuoSeatsSettingsSection`, `BoxesSettingsCard`, `EmailReaderSettingsCard` (owner/dev), `ReplyPushSettingsCard` (owner/dev). Each: optional `io` prop with a module `DEFAULT_IO = supabaseXIo()`, `useEffect` load with a `live` flag, `cardStyle`, `<section aria-labelledby="phone-texts-…" data-settings-…>` + `<h3 id=…>`, errors through `formatErrorMessage` in `role="alert"`, buttons from `src/components/contracts/clauseStyles`. Reads `.from('app_settings').select('value_text').eq('key', K).maybeSingle()`; writes `.update({ value_text }).eq('key', K).select('key')` and treat zero rows as refused. Switch cards ask before turning on (`useConfirmDialog`, `confirmLabel: 'Turn it on'`); save buttons read "Save the seats" / "Save the inboxes" + "Put them back"; the typed-setting pattern is the office-wait minutes in `ReplyPushSettingsCard.tsx` 140–183 (`parseOfficeWait`, a separate "Save the wait", `update({ value_num })`). A time input precedent: `src/components/SalaryWorkScheduleSettings.tsx`.
- Role gate: every "owner or dev" is `role === 'master_technician' || role === 'dev'` (SQL `is_master_or_dev()`), copied per card (`canSwitchTexts`, `canSetAssignSeats`, `canSwitchReader`, `canSwitchReplyPush`, `canSetAppSends`). No shared helper — add `isOwnerOrDev(role)` in `src/lib/gc/access.ts` in PR 1 and use it from then on. `UserRole` is in `src/hooks/useAuth.ts`; the owner's role is `master_technician`.
- Office hours: `src/lib/messages/hasRule.ts` — `OFFICE_HOURS_KEY = 'messages_office_hours_v1'`, `interface OfficeHours { days: readonly number[] /* 0 Sun … 6 Sat */; opens: 'HH:MM'; closes: 'HH:MM'; techUntil: 'HH:MM'; emergency: string|null }`, default/seed `{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}`; `parseOfficeHours(valueText)` falls back per field, drops empty `days` to Mon–Fri, resets both times when `opens >= closes`, normalises `emergency` to ten digits or null. Read by `supabase/functions/_shared/messagesReplyPush.ts:68` (`planReplyPushes`) and `_shared/quoTechSend.ts:211` (`techHoldUntil`). **`hasRule.ts` is a mirrored kernel** (`gcKernels/lib/messages/hasRule.ts`): don't touch it from the card; put the serializer and words in a new `officeHoursCard.ts`. The UPDATE policy `master_or_dev_update_messages_office_hours` exists (`20261013190000_messages_tech_door.sql`); SQL test `supabase/tests/messages_spine/30_tech_door.sql`.
- The eight switches (no multi-key reader exists; write one `.select('key, value_text, value_num').in('key', […])` as `supabaseReplyPushSwitchIo().load` does):

  | Switch | Key | Parse | "On" |
  |---|---|---|---|
  | Send texts | `messages_texts_on_v1` | `textsAreOn` (`src/lib/quo/textsSwitch.ts`) | `=== 'true'` |
  | Read bids@ | `gmail_sync_on_v1` | `readerIsOn` (`messages/emailReader.ts`); health `gmail_sync_state.last_ok_at/last_error` | `=== 'true'` |
  | Who gets a new message | `messages_assign_rule_v1` | `parseAssignSeats` → `{ customer, trade, arch }` uuids/null | `customer && trade` set (`arch` null = same as trades, fine) |
  | The team inbox | `messages_boxes_v1` | `parseBoxSettings` → `{ team: { address, phone, numberId }, bids }` | `team.address.trim() !== ''` |
  | Reply push | `messages_reply_push_on_v1` | `replyPushIsOn` (`replyPushSwitch.ts`) | `=== 'true'` |
  | Company phone seats | `messages_quo_seats_v1` | `parseQuoSeats` → `QuoSeatRow[]` | `length > 0` (the row's words: "a seat per person or one shared by the office"; **not** "Call back in Quo") |
  | Reminders | `messages_nudge_app_sends_v1` | `appSendsFrom` (`flows/nudgeRunInputs.ts`), `appSendMode(sends, kind, stepId)` → `'off'|'offer'|'send'` | residential `approved` (the estimate follow-up) and `paid` (the bill) both `!== 'off'`; set with `supabaseAppSendsIo().set(kind, stepId, mode)` (`flows/appSendsIo.ts`) |
  | Office hours | `messages_office_hours_v1` | `parseOfficeHours` | "set" = the card has saved it at least once: PR 1 writes `savedAt: <ISO>` into the same JSON (`parseOfficeHours` reads only its five fields; confirm it ignores extras, else add the field to the type and regenerate the mirror) |

- Deep links: `/settings?tab=settings-phone-texts`, `/settings?tab=settings-flows`. Card ids `phone-texts-send-texts`, `-who-gets-it`, `-quo-seats`, `-boxes`, `-read-bids`, `-reply-push`; **`resolveSettingsDeepLink` (`src/lib/settingsDeepLink.ts`) scrolls only to hashes that start with `settings-` and are in `SETTINGS_HASH_ANCHOR_TO_TAB`** — add one entry per card (`'settings-phone-texts-hours': 'settings-phone-texts'` …) and give each card that id, or the doors land at the top of the group. Settings → Flows opens on the `trade` kind with no URL param (`SettingsFlowsTab.tsx:40`); PR 2's Reminders door can only land on the Flows tab.
- Tests to copy: `src/components/settings/*.render.test.tsx` (role via `vi.hoisted(() => ({ role: 'master_technician' }))` + `vi.mock('../../hooks/useAuth', … useAuthModuleMock())`), the pure pairs beside each io (`replyPushSwitch.test.ts`, `replyPushSwitchIo.test.ts`).

### 1.4 The lanes' reads (the strip's inputs), 16-polish

- `messages` time column is **`at`** (no `created_at`).
- `wentOutIo.ts` `loadWentOut(now, client)`: `channel in (text,email)`, `direction = 'out'`, `at >=` 7 days back, limit 300; `WentOutLine { id, contactId, name, customerName, kind, channel, subject, body, atMs, who, delivery, number, estimate: { number, opened, accepted } | null }`; "not delivered" = `deliveryMark(m)?.bad`; the private `withEstimateDid` matches estimate emails by subject (`estimateDoorFor`) and reads event keys `messages.quo_id in ('estimate:<id>:opened', '…:accepted')` — it misses an estimate sent by text only.
- Event lines: `supabase/functions/_shared/estimateEventLine.ts` + `estimateThreadLine.ts`: `channel 'event'`, `direction 'team'`, `who_text 'The app'`, `quo_id` = `estimate:<id>:opened|accepted|declined`.
- `waitingOnThemIo.ts` `loadWaitingOnThem`: 30 days, `direction in (in,out)`, `channel in (text,email,call,voicemail,missed)`, limit 1500 → `WaitLine`; `waitingOnThem(lines, pill, now)` → `WaitingRow { contactId, name, days, chip, words, when, tel, atMs }` (no message id, no step). It reads no promise and no back day.
- `MessagesView` (`messagesIo.ts:30` = `{ contacts, messages: ThreadMessage[], rails, tiles, userNames }`) is **not loaded on a plain `/messages` visit** (`useMessagesHost` is enabled only for the people list, a thread, Everyone or a search) and reads every message ever; it also lacks `quo_id` and the contacts' state/has. **The strip gets its own 14-day read** (7 days + 7 for last week's share), not the view.
- There is **no reply-latency fact** anywhere (`courtFacts.ts` builds `owed` and `promisedUntil` only).
- The estimate funnel's cleaner source: `estimates.sent_at` / `status` (`'sent'`, `'customer_accepted'`, …) + `estimate_customer_events(estimate_id, event_type 'public_link_view'|'public_accept_submitted', occurred_at)` — **RLS for the office roles on `estimate_customer_events` is unverified**; fall back to the event lines (`quo_id` keys) if the read is refused.
- The Nudge path: `WaitingOnThem.tsx` Nudge → `onOpenThread(r.contactId)` (no draft); `NudgesFromTheFlow.tsx` "Text Greg" → the same (no prefill today, despite the guide). The morning run's words: `nudgeLine(person: { first, reading }, def: FlowStep, quickReplies, link)` (`src/lib/flows/nudgeDispatch.ts:188`) tries the team's step line (`stepLine(quickReplies, kind, stepId, '')`, `quickReplies/kernel.ts:316`), then `NUDGE_LINES[stepId]`, then a paper check-in, then "{first}, checking in on {step}. Anything you need from us?". The step for a person: `useFlowNow(contactId)` (`src/hooks/useFlowNow.ts` → `{ stepId, jobId, stepName, who, sinceYmd, finishes, papers }`) or `useFlowPerson({ contactId }).got.person` (a `PersonFlow`); batched: `useFlowNudges` / `loadNudgeBatch` (`flows/flowNudgesIo.ts`). **Residential `approved` (the estimate follow-up) and `paid` (the bill) have no `NUDGE_LINES` entry and no seeded quick reply** — the fallback reads "Dana, checking in on approved." Good words exist in `SEED_CALL_SCRIPTS.approved` (`flows/callScripts.ts`) and `DEFAULT_LINES.estimate` (`tellCustomer.ts`). Trade `ask`: `NUDGE_LINES.ask` = "checking on the number. Still good for the day you gave us?".
- GC projects → Messages: `src/pages/GcProjects.tsx` ~2009–2021 (`devPill('messages', 'Messages')` → `showView`; `<GcMessages …/>` when `devView === 'messages'`); `src/lib/gc/links.ts` `GC_MESSAGES_HREF = '/gc?view=messages'`, `messagesThreadHref()`; **keep `/gc?view=messages&thread=…` working** (used by `customerThread.ts`, the reply push link `notifyRule.ts:88`, `DetailJobModal`, `JobCustomerSheet`, `MessagesButton`, and the edge copy `gcKernels/lib/gc/links.ts`) — only the pill becomes a link.
- Dashboard: `src/lib/dashboardNeedsYou.ts` (`CUSTOMER_MESSAGES_HREF = '/messages?kind=customer'`, `customerMessagesLine`), counts from `src/lib/followUp/customerCountsIo.ts` `loadCustomerMessagesCounts` (the pattern for a queue read outside the panel: `io.loadQueue(todayYmd)` → `followUpInputFromRows` → `followUpQueue(input, { newLane: followUpNewLane(...) })`).

---

## 2. The PRs

Each PR below lists: goal · the decision it carries · files (**new** / existing) · the kernel · the words · tests · docs · the "best we can do" check · verify. Sizes are honest after the read (two grew).

### PR 1 — Office hours card (S)

**Goal.** Settings → Phone and texts gains **Office hours**: days, open, close. Saves the JSON `hasRule.ts` already reads, keeping `techUntil` and `emergency` as they are.

**Decision.** Build. "Set" (for PR 2's chip) = the card has saved once: write `savedAt: <ISO>` into the same JSON (`parseOfficeHours` ignores unknown fields — confirm by reading it; if it strips them, add the field to the type in `hasRule.ts` and regenerate the mirror).

**Files.**
- **new** `src/lib/messages/officeHoursCard.ts` — pure: `OFFICE_HOURS_WORDS` (title *Office hours*, note *When the office is in. Outside these hours a reply waits for the morning, and the office hears it first.*, days label, open/close labels, save *Save the hours*, put back *Put them back*, the not-allowed line *The owner or a dev sets the hours.*, the bad lines *Pick at least one day.* / *Close must come after open.*, the saved toast *Office hours saved.*), `OfficeHoursDraft { days: number[]; opens: string; closes: string }`, `draftFrom(hours: OfficeHours)`, `draftProblem(draft) → string | null`, `serializeOfficeHours(current: OfficeHours, draft, savedAtIso) → string` (keeps `techUntil`, `emergency`; adds `savedAt`), `officeHoursSet(valueText) → boolean`, `hoursLine(hours) → 'Mon to Fri, 7:30 AM to 5:00 PM'` (12-hour words for the card's read-only line; `DAY_SHORT`).
- **new** `src/lib/messages/officeHoursCardIo.ts` — `OfficeHoursIo { load(): Promise<{ hours: OfficeHours; raw: string | null }>; save(valueText: string): Promise<void> }`, `supabaseOfficeHoursIo()` on `app_settings` key `OFFICE_HOURS_KEY` (update-only; zero rows → throw `OFFICE_HOURS_NOT_SAVED`).
- **new** `src/components/settings/OfficeHoursSettingsCard.tsx` — `<section aria-labelledby="phone-texts-hours" id="settings-phone-texts-hours" data-settings-hours>`; seven day toggles (`aria-pressed`), two `<input type="time">`, the line under them, Save the hours (disabled until changed and valid), Put them back; read-only for non-owner/dev with the not-allowed line.
- `src/lib/gc/access.ts` — add `isOwnerOrDev(role)`; use it here (don't refactor the other cards in this PR).
- `src/pages/Settings.tsx` — mount after `ReplyPushSettingsCard`.
- `src/lib/settingsDeepLink.ts` — `'settings-phone-texts-hours': 'settings-phone-texts'`.
- `docs/MESSAGES_ARCHITECTURE.md` § the switches: the Office hours row loses "set by a dev (no card yet)".

**Tests.** `officeHoursCard.test.ts` (draft from the default; problems: no days, close ≤ open; serialize keeps `techUntil`/`emergency` and adds `savedAt`; `officeHoursSet`; plain words of every sentence through `plainWordsFailures`), `officeHoursCardIo.test.ts` (update-only, zero rows refuses), `OfficeHoursSettingsCard.render.test.tsx` (owner sees the inputs and saves; assistant sees the line and no Save; a bad draft disables Save and shows the reason).

**Guide.** `src/content/help/turn-on-the-reply-push.md` gains a short section *Set the office hours* (the card, what after hours means today: the office hears first, the reply waits for the morning — **not** an auto-answer, which is not live). Keywords: office hours.

**Best we can do.** Should the card also show the tech's "texts until" (`techUntil`)? Recommended: no, not in this PR — it is the tech door's setting (R5) and has its own words; note it as not carried.

**Verify.** Save Mon–Fri 7:30–5:00 as the owner on prod; read the row back with the dev MCP (`read_rows app_settings` key `messages_office_hours_v1`) — the JSON keeps `techUntil` and `emergency`.

### PR 2 — Finish switching Messages on (M)

**Goal.** For the owner and devs, a line at the top of Messages — *Finish switching Messages on · 3 of 8 on ›* — that opens a card listing the eight switches, each with a status chip and a door to its setting. **Later** folds the line for a week (localStorage, per browser). The line is gone when all eight are on.

**Decision.** On Messages, owner/dev only (decision 6 as taken).

**Files.**
- **new** `src/lib/messages/switchCard.ts` — pure: `SwitchKey` (the eight), `SWITCH_ROWS: { key, title, why, settingsHref, door }[]` (words below), `SwitchState = 'on' | 'off' | 'not_read' | 'nobody' | 'not_set'`, `switchStates(raw: Record<string, { value_text, value_num }>) → Record<SwitchKey, SwitchState>` using the parsers in §1.3, `onCount(states) → { on, of: 8 }`, `cardLine(count) → 'Finish switching Messages on · 3 of 8 on'`, `allOn`, `laterUntil(now) → ISO (+7 days)`, `SWITCH_WORDS` (title, note *3 of 8 on. The page works before all eight. The loop closes when they are.*, Later, the footer *Only the owner and devs see this card.*).
- **new** `src/lib/messages/switchCardIo.ts` — one read of the eight keys from `app_settings` (`.select('key, value_text, value_num').in('key', KEYS)`), `supabaseSwitchCardIo()`.
- **new** `src/components/messages/SwitchOnCard.tsx` — the line (a button) + the card (a `ResponsiveModalShell`, or an inline fold under the title; recommended inline fold, no modal, so it reads on a phone), rows with `Chip` tones (green On; red Not read for the team inbox; amber Off/Nobody/Not set), each door a `Link` to the settings href; **Later** writes `messages_switch_card_later_until` to localStorage (try/catch).
- `src/pages/Messages.tsx` — `isOwnerOrDev(role) && <SwitchOnCard />` in the title row (right side), hidden while `searching`.
- `src/lib/settingsDeepLink.ts` + each Phone and texts card — ids `settings-phone-texts-send-texts`, `-who-gets-it`, `-quo-seats`, `-boxes`, `-read-bids`, `-reply-push` (keep the old `phone-texts-*` ids on the `<h3>`; put the new id on the `<section>`), entries in `SETTINGS_HASH_ANCHOR_TO_TAB`.

**The rows' words** (title · why · door):
1. Send texts · the office texts from the company number · Turn it on → `/settings?tab=settings-phone-texts#settings-phone-texts-send-texts`
2. Read bids@ · trades' emails land in their threads · Turn it on → `#settings-phone-texts-read-bids`
3. Who gets a new message · the seats · Pick the seats → `#settings-phone-texts-who-gets-it`
4. The team inbox · a customer's emailed reply lands in their thread, not someone's Gmail · Set the address → `#settings-phone-texts-boxes`
5. Reply push · whoever has it hears a reply on their phone · Turn it on → `#settings-phone-texts-reply-push`
6. Company phone seats · a seat per person, or one shared by the office · Pick the seats → `#settings-phone-texts-quo-seats`
7. Reminders the app offers · the estimate follow-up and the bill, as Offers you press · Offer them → `/settings?tab=settings-flows` (lands on the Flows tab; the residential kind is a press away — say so in the row's small print until the tab takes a `kind` param)
8. Office hours · after hours the office hears first and the reply waits for the morning · Set the hours → `#settings-phone-texts-hours`

**Tests.** `switchCard.test.ts` (every state from raw rows; the count; `allOn`; plain words), `switchCardIo.test.ts`, `SwitchOnCard.render.test.tsx` (the line's count; opening; Later hides it and `laterUntil` is kept; a door's href), `Messages.render.test.tsx` (dev sees the line; assistant does not).

**Docs.** `ACCESS_CONTROL.md` (owner/dev-only card), `PROJECT_DOCUMENTATION.md` § Messages (the line), `docs/MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md` (point at the card as the switch-on's home), guide *answer everyone waiting on us from one page* (a short *Finish switching on* section for the owner).

**Best we can do.** Row 7's door lands on the wrong flow kind. Fix it properly here if cheap: `SettingsFlowsTab` reads `?kind=residential` into its `useState<EditorKind>` initial value (one line) and the door carries it. Recommended: do it.

**Verify.** As the owner on prod: the line reads the true count; each door lands on its card (scrolls); Later hides it; turn one switch on and the count moves.

### PR 3 — Show: Mine · Everyone (M)

**Goal.** A two-value lens beside the kind pills that narrows every lane (and the Sort desk, for free) to what I hold. Remembered per browser; starts on Everyone.

**Decision.** Two values (revision 1). Default Everyone (decision 2). The phone fold keeps reading the whole queue's count (`onCount` is before `narrow`): it folds only when truly nothing waits — keep that, say so in a comment.

**Files.**
- **new** `src/lib/messages/showLens.ts` — `ShowLens = 'mine' | 'everyone'`, `SHOW_WORDS` (label *Show*, mine *Mine*, everyone *Everyone*, titles), `queueForShow(queue, contacts: readonly { id; hasUserId: string | null }[], lens, meId)` written exactly like `queueForPill` (filters each lane by `contactId ∈ held`, drops `clauses`, recounts), `lensCounts(queue, contacts, meId) → { mine, everyone }`, `SHOW_STORAGE_KEY = 'messages_show_lens'`, `readLens()` / `keepLens()` (try/catch).
- `src/pages/Messages.tsx` — state `lens` from storage; the control after the pills (a `role="radiogroup" aria-label="Show"` of two `aria-pressed` buttons with counts); `narrow = (queue, contacts) => queueForShow(queueForPill(queue, contacts, pill), contacts, lens, me.id)`; WaitingOnThem and WentOut are **not** narrowed by the lens (they have no holder) — say so in the guide.
- `src/lib/followUp/followUpDemo.ts` — give the demo contacts `hasUserId` so the kernel test can use the Friday fixture.

**Tests.** `showLens.test.ts` (Mine keeps only `hasUserId === me`; Everyone is identity; counts; the Sort desk's lane narrows with it; plain words), `Messages.render.test.tsx` (press Mine → only held rows; the choice survives a remount via storage; the fold stays on the whole count).

**Guide.** *answer everyone waiting on us from one page* § *Show one kind of person* gains a paragraph: *Show narrows the lists to what you hold. Press Mine…*; GLOSSARY *Show (Messages)*.

**Best we can do.** Should Mine also sort New's "Who has it?" rows out? New's people are nobody's by definition, so under Mine, New is empty — the fold line should say *New 0* then, not hide New. Keep New visible and empty under Mine (it tells the truth).

**Verify.** On prod as the sample assistant holding one row (Take it on a ZZ row first): Mine shows that row alone; Everyone shows all.

### PR 4 — Nudge fills the step's words (M)

**Goal.** Waiting on them's **Nudge** opens the thread with the reply box already holding the step's reminder line (as the morning run would send it) and the send window open: one read, one press. A text that did not deliver offers **Call them** and **Send it as an email** instead of Nudge. "Text Greg" on Nudges from the flow gets the same fill (it is documented as doing this and does not).

**Decision.** Fill + the send window (decision 7).

**Files.**
- **new** `src/lib/messages/nudgeDraft.ts` — `nudgeDraftFor(row: { contactId }, person: PersonFlow | null, quickReplies, link) → { kind: 'text'; words } | null` wrapping `nudgeLine` (reuse, don't copy); the fallback when the person has no flow step: *{first}, checking in. Anything you need from us?*; `NUDGE_PARAM = 'nudge'`.
- `src/lib/flows/nudgeDispatch.ts` `NUDGE_LINES` — add residential `approved` (*checking in on the estimate for {job}. Any questions I can answer before you decide?*, from `SEED_CALL_SCRIPTS.approved`) and `paid` (*a reminder from Click Plumbing: {amount} is open on {job}. Pay here: {bill}* — reuse `DEFAULT_LINES`' bill words from `tellCustomer.ts`, same `{bill}`/`{amount}` fills the job window already uses). This fixes the morning run's words too — say so in the fragment.
- `src/components/gc/messages/openThread.ts` — `OpenThread` gains `draft?: { kind: 'text' | 'email'; words: string; send: boolean } | null`.
- `src/components/gc/messages/useThreadWindow.ts` — read/write `&nudge=1` beside `?thread=`; `openThread(contactId, at?, { nudge?: true })`.
- `src/components/gc/messages/threadSlots.tsx` — when the URL carries `nudge=1`, resolve the draft (`useFlowPerson({ contactId })` + `useQuickReplies(…, true)`) and pass `startWords={draft.words}` and a new `startSend` prop; `ReplyBox` gains `startSend?: 'text' | 'email'` that calls the internal `press()` once the words are in (one effect, guarded by a ref so it fires once).
- `src/components/messages/WaitingOnThem.tsx` — `Nudge {first}` → `onOpenThread(contactId, undefined, { nudge: true })`; when the row's newest line is a text with `deliveryMark(...).bad`: buttons **☎ Call them** (tel) and **Send it as an email** (opens the thread with the same words as an email draft, `kind: 'email'`); `WaitingRow` gains `delivery` and `lastMessageId` (`waitingOnThemIo.ts` selects `delivery`).
- `src/components/followUp/NudgesFromTheFlow.tsx` — "Text Greg" passes `{ nudge: true }` too.

**Tests.** `nudgeDraft.test.ts` (step line first; `NUDGE_LINES` second; the fallback; plain words of the new lines), `nudgeDispatch.test.ts` (the two new step lines), `waitingOnThem.test.ts` (a failed text's row carries `delivery`), `WaitingOnThem.render.test.tsx` (Nudge calls `onOpenThread` with `nudge`; a failed text shows Call them and Send it as an email), `ReplyBox.render.test.tsx` (`startSend` opens the send window once with the words), `useThreadWindow` test (the param round-trips).

**Guide.** *answer everyone waiting on us from one page* § *See who went quiet on us*: *Press Nudge. The thread opens with the reminder written for their step. Read it, then press Send as text.*; *see who is waiting on us…* § Nudges from the flow: same words for Text Greg.

**Best we can do.** The send window's Escape closes it and leaves the draft in the box — fine. But a nudge on a person whose number sent STOP must not open a text draft: `textBoxBlocked` already handles it — the draft falls to email when `canSend('text', to)` is false. Test that.

**Verify (Route B).** On a ZZ customer with an opened, unaccepted estimate: Nudge → the window shows the estimate follow-up with the job's name filled → the human presses Send as text → Went out shows it; the row leaves Waiting on them.

### PR 5 — The last 7 days strip (L)

**Goal.** Under the pills, four tiles over the last 7 days, each a door: *Answered within an hour* (count, share, last week's share) → Needs a reply; *Longest wait right now* (who, who has it) → the thread; *Texts not delivered* → Went out with its red rows; *Estimates* (sent → opened → accepted, how many opened and quiet) → Waiting on them. A tile with nothing behind it reads *none*.

**Decision.** On Messages (decision 1). Its own 14-day read, not the page's view (§1.4).

**Files.**
- **new** `src/lib/messages/weekStrip.ts` — pure. Input `StripLine { id; contactId; direction: 'in'|'out'; channel; atMs; who; delivery; isApp: boolean }` and `StripEstimate { id; number; sentAtMs | null; opened: boolean; accepted: boolean }` plus `needsReply: { contactId; name; has: string | null; waitingSinceMs }[]`. Functions: `turns(lines) → { contactId; inAtMs; outAtMs | null }[]` (one turn per inbound run: the first `in` after our last `out`; the answer = the first later `out` on that contact that is a text/email/call and not `isApp` and not a sent-copy overlay), `answeredWithinHour(turns, window) → { count, of, share }`, `lastWeekShare`, `longestWaitNow(needsReply, now) → { contactId; name; has; words: '2 d 4 h' } | null`, `textsNotDelivered(lines, window) → { count; first: { contactId; name } | null }`, `estimateFunnel(estimates, window) → { sent, opened, accepted, openedQuiet }`, `STRIP_WORDS` (title *The last 7 days*, note *each number opens its rows*, the four labels, *none*, `fromLastWeek(share)` → *↑ from 71% last week* / *↓ from 90% last week* / *same as last week*), `stripTiles(...) → Tile[]` (`{ key, label, value, sub, door: { kind: 'needs-reply' | 'thread' | 'went-out' | 'waiting'; contactId? } }`). Notes do not count as an answer (`courtOf` ignores them; say why in a comment).
- **new** `src/lib/messages/weekStripIo.ts` — `loadWeekStrip(now, client)`: `messages` 14 days back (`direction in (in,out)`, `channel in (text,email,call,voicemail,missed)`, columns `id, contact_id, direction, channel, at, who_text, delivery, quo_id`), the estimate funnel from `estimates` (`sent_at >= 7 days back`, `status`) + `estimate_customer_events` (**check RLS for assistant/estimator first — `read_rows` as the sample assistant through the dev MCP, or a smoke on prod; if refused, read the `quo_id` event lines instead** as `wentOutIo.ts` `withEstimateDid` does), and the queue's first Needs a reply row through `customerCountsIo.ts`'s pattern (`io.loadQueue` → `followUpQueue`). The queue read is already made by `FollowUpPanel`; **don't read it twice** — lift the `needsReply[0]` through a new `onLongestWait?(row | null)` prop on `FollowUpPanel` instead (one line beside `onCount`). Recommended.
- **new** `src/components/messages/WeekStrip.tsx` — the strip; tiles are buttons: needs-reply scrolls to `[data-testid="queues"]`, thread → `onOpenThread(contactId)`, went-out → scrolls to the Went out section and sets its filter to **Texts** (add a `notDelivered` filter? recommended: no, the red rows already stand out; scroll + Texts), waiting → scrolls to Waiting on them. Give `WentOutToday` and `WaitingOnThem` sections `id`s (`went-out`, `waiting-on-them`). Phone: two by two (`useMatchMedia`).
- `src/pages/Messages.tsx` — mount under the pills (hidden while `searching`), pass `onLongestWait`.
- `src/components/messages/WentOutToday.tsx` — accept `filter` as a controlled prop from the page (optional; default internal).

**Tests.** `weekStrip.test.ts` (turns: three texts in a row count once; an app send does not answer; a note does not answer; the share and last week's; longest wait words; not-delivered count; the funnel incl. opened-and-quiet; a window with nothing → *none*; plain words), `weekStripIo.test.ts` (the three reads, the window maths), `WeekStrip.render.test.tsx` (four tiles, each door's effect), `Messages.render.test.tsx` (the strip mounts with the lanes; hidden while searching).

**Guide.** *answer everyone waiting on us from one page* gains *## See how the week went* (what each number means in one sentence each; "a number opens the rows behind it"). GLOSSARY: *The last 7 days (Messages)*. PROJECT_DOCUMENTATION § Messages.

**Best we can do.** The answered share double-counts a person who writes at 9 and again at 9:05 before we reply — the "turn" rule handles it; test it. The longest wait tile must respect the lens? No: the strip is the office's read, not mine — say so under the tile when Mine is on (*the office's longest wait*).

**Verify.** On prod, compare the four numbers to the rows by hand for one day (Went out's red rows = the not-delivered count; the first Needs a reply row = the longest wait).

### PR 6 — Answer all (L)

**Goal.** A button on Needs a reply's header (the `Section` `action` slot, like Sort all) that walks the lane one person at a time: the person, their last words, their job and step, the step's quick replies, the reply box, Tie to, After this sends; **Send text… / Send email…**, **No reply needed**, **Skip for now**, **☎ Call**. A send or a No reply needed moves on. The end says what went and offers the quiet ones.

**Decision.** Needs a reply first; the quiet ones offered at the end as a second pass that opens Waiting on them's first row with the PR 4 nudge (decision 3). Under Mine the desk walks only what I hold (the lens narrows `drawn`).

**Design (from §1.1/1.2 — the parts that are not obvious).**
- Reuse the kernel moves `deskStep` / `skipOne` from `sortDesk.ts`; **give Answer all its own words and card**: `answerDesk.ts` with `ANSWER_ALL = 'Answer all'`, `ANSWER_ALL_MIN = 1`, `answerProgress(left, of)` → `['Needs a reply', `${left} to answer`, `${n} of ${of}`]`, `ANSWER_DONE { title: 'All answered.', words(sent: { texts, emails, notes, noReply, skipped }) }`, `NEXT_LINE`.
- **Pin `current` in state.** `deskStep` re-picks the first unskipped person on every render, and a live re-read (`useMessagesLive`) can reorder the lane under a half-typed draft. The desk keeps `currentId` and moves only on send, No reply needed, or Skip; if the current person leaves the lane (they wrote back), show a one-line note (*Tom wrote back. Their row moved to the top.*) and a **Next** button rather than swapping the card.
- **The reply box needs a full `Contact`**: `loadContact(contactId)` (`messagesIo.ts:454`) per person (`deskContact()` has no channels and would block sending). Wrap it in `OpenThreadContext.Provider` with `{ contact, lines, jobFilter: null, rail, tiles, userNames, nowIso, searchJobs }` built from `useMessagesHost().view` the way `ThreadWindow.tsx:166` does — so the desk **enables the host's view** (`useMessagesHost({ enabled: canOpen && (… || answering) })`). The reply box is keyed per person (`key={'reply:'+id}`).
- **After this sends** renders only when `owedStore.open.contactId === id`: the desk calls `owedStore.publish(id, drawn.weOwe.find(r => r.contactId === id)?.owed ?? null)` on each person and `unpublish` when moving on.
- **Reread.** Wrap the box in `MessagesRereadContext.Provider value={() => void q.reload()}` so a send re-reads the lane.
- **Escape.** `ResponsiveModalShell` closes on window keydown without checking `defaultPrevented`; the send window's Escape would close the desk and lose the draft. Give the shell an `ignoreEscapeWhen?: () => boolean` prop (or check `defaultPrevented`) in this PR — a one-line, behavior-preserving change; test it.
- **No reply needed** runs through the panel's `q.press('state …', io => io.setState(id, 'done'))`; pass `actions` (or `press`) into the desk, as the Sort desk gets `sortIo`.
- **What went** for the end card: wrap the `ReplyIo` passed to the box to record `sendText` / `sendEmail` / `addNote` answers per person (`deskLog`).
- Quick replies for the step: pass `stageStepIds` from `useFlowNow(contactId)` (or `openStrip` so the strip shows); the first chip is the draft only if the office presses it (no auto-fill in Answer all — the person's own words matter; Nudge is the auto-fill).

**Files.** **new** `src/lib/followUp/answerDesk.ts` (+ test), **new** `src/components/followUp/AnswerAllDesk.tsx` (+ render test), `sortDesk.ts` (export the generic moves unchanged; no words change), `FollowUpSections.tsx` (`FollowUpSectionActions.answerAll?`; the Needs a reply `Section action`), `FollowUpPanel.tsx` (`answering` state; mount the desk with `lane={drawn.needsReply}`, `lines`, `contacts`, `press`, `reread`), `src/components/ResponsiveModalShell.tsx` (the Escape guard), `Messages.tsx` (`enabled` includes answering — expose it from the panel through an `onAnswering?(boolean)` prop, or lift the state to the page; recommended: lift `answering` to the page and pass `answerAll` down, so the host's `enabled` sees it), `src/components/followUp/useThreadOwed.ts` (nothing, if `owedStore.publish` is public — confirm).

**Tests.** `answerDesk.test.ts` (progress words; done words per tally; pinned current stays while the lane reorders; the person leaving the lane; plain words), `AnswerAllDesk.render.test.tsx` (three people: a text send moves on and the tally counts it; No reply needed moves on; Skip sends to the back; the end card; Escape inside the send window keeps the desk), `FollowUpPanel.render.test.tsx` (the button on the header; hidden when the lane is empty), `Messages.render.test.tsx` (Answer all under Mine walks held rows only).

**Guide.** *answer everyone waiting on us from one page* gains *## Answer everyone, one at a time* (the walk; Skip; No reply needed; the end; the quiet ones). `sort-new-messages.md` cross-links (*Answer all works like Sort all*). GLOSSARY *Answer all*. PROJECT_DOCUMENTATION § Messages.

**Best we can do.** A person with no number and no email (a portal-only customer) cannot be answered from the desk — the box's own refusal line shows; the desk should offer **Open the thread** for them and move on. Build that. Also: don't auto-open the send window on a quick-reply press here (Nudge's behavior) — the office reads first.

**Verify (Route B).** Two ZZ rows in Needs a reply (seed two inbound texts by SQL through the pooler, §3): Answer all → the first card → the human presses Send as text → the second card → No reply needed → the end card with 1 text, 1 no reply; Went out shows the one text.

### PR 7 — Log a call (M + migration)

**Goal.** A fourth kind in the reply box, **Call**: what they said, the day they gave, whose move it leaves. It lands as our line (`channel 'call'`, `direction 'out'`), team-visible like any line, so Needs a reply clears and the thread's chip flips to their move; the day they gave holds Waiting on them until it comes and shows in the header as *Their move · until Tue Oct 27*.

**Decision.** Revision 2: an RPC and a migration. The call's time is now (the form logs the call you just made).

**Migration** `supabase/migrations/<next>_log_call.sql` (`SET lock_timeout = '3s';` first):
- `CREATE OR REPLACE FUNCTION public.log_call(p_contact_id uuid, p_said text, p_day date, p_day_words text, p_job_kind text, p_job_id uuid, p_their_move boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER` — guard with the same office check `add_note` uses (`is_office_team()` or the function it calls — read `add_note` in `20261012160000_messages_follow_up.sql:704` and copy its guard); insert `messages (contact_id, channel 'call', direction 'out', who_user_id auth.uid(), who_text follow_up_user_name(auth.uid()), body := 'Called ' || name || '. They said: ' || p_said, at now(), bid_id/project_id/jobs_ledger_id from p_job_*)`; when `p_day` is not null insert `message_promises (message_id, kind 'said', state 'written', until_on p_day, words p_day_words, decided_by auth.uid(), decided_at now())` — **read the table's CHECK on `kind` first** (`20261012160000_messages_follow_up.sql:145`); if `kind` is constrained, add `'said'` with `ALTER TABLE … DROP CONSTRAINT … ADD CONSTRAINT … CHECK (kind IN (…, 'said'))` (additive); if `p_their_move` is false, do nothing more (the court reads last in vs last out, and our call is the last out — "Our move" then means the office writes what it owes through the existing `mark_owed`, which the form offers as the two blanks, same as the send window); close the person's open `call_tasks` as `call_tasks_close_by_call` does (read `20261016050000_call_tasks.sql`; it is service-role only — copy its UPDATE into `log_call`). `GRANT EXECUTE … TO authenticated`.
- `docs/migrations/<version>_log_call.md`; EDGE_FUNCTIONS untouched (no function).
- The trigger `messages_move_state` already clears `state` and `has_user_id` on an `out` line — verify with the SQL test pattern in `supabase/tests/messages_spine/` (add `3x_log_call.sql`: a waiting contact, `log_call`, state is done, the promise row exists).

**Client.**
- `src/lib/messages/compose.ts` — `ReplyKind` adds `'call'`; `REPLY_KINDS` gains `{ kind: 'call', label: 'Call', send: 'Save the call' }`; `goesOut('call') === false`; `canSend('call', …)` true; `boxPlaceholder('call', name)` → *What Tom said on the call*; `countLine('call', body)` → `[words, 'only the team sees it']`; `sentWords('call', …)` → *Call saved. Only the team sees it.*; `CALL_ASIDE = ['they gave a day', 'their move clears the row']`.
- `src/components/gc/messages/reply/kindLook.ts` — `call: { … green ring … }` (saturated status color stays literal; surfaces by token).
- **new** `src/lib/messages/callLog.ts` — `CallLogDraft { said: string; day: DayKept | null; theirMove: boolean }`, `callLogProblem(draft)` (*Write what they said first.*), `CALL_WORDS` (labels *What they said*, *They gave a day*, *After this: Their move · Our move*, the hint *Their move clears Needs a reply. Waiting on them waits for the day.*, the thread line words `callLineBody(name, said)`), `callDayHolds(promise, todayYmd)`.
- `src/lib/messages/replyIo.ts` — `ReplyIo.logCall(contactId, draft, jobKey) → Promise<string>` → rpc `log_call`; `supabaseReplyIo` + the fake in tests.
- `ReplyBox.tsx` — the Call kind renders the two fields (a textarea + `NoteBackDay` reused for the day) and the After this radios; **Save the call** calls `io.logCall`, then `after('call', …)`. With `kinds` passed (job windows) the Call kind is not offered.
- `src/lib/messages/thread.ts` — `channelWord` already says *Call*; a `direction 'out'` call with `who` = a person reads as ours (blue tone). Nothing to change; test it.
- `src/lib/messages/waitingOnThem.ts` + `waitingOnThemIo.ts` — read written promises with `until_on >= today` for the people in the window (one more select on `message_promises` joined through `messages.contact_id`), and **hold** a row whose promise day has not come (`chip: 'Their move · until Tue Oct 27'`, sorted after the quiet ones). The hold also applies to promises written by *Write down their word* — a bonus, say so.
- `src/components/gc/messages/ThreadWindow.tsx` (+ `useFollowUpThreadSlots`) — read the court facts for the open contact (`loadCourtFacts` exists and is unused; call it from the follow-up thread slots and pass `{ owed, promisedUntil }` into `courtOf`'s options, which already accept them) so the chip reads *Their move · until …*. This is the first caller of `loadCourtFacts`; keep it to the thread.

**Tests.** `compose.test.ts` (the fourth kind; plain words), `callLog.test.ts`, `replyIo.test.ts` (`logCall` → rpc args), `ReplyBox.call.render.test.tsx` (pick Call, type, pick a day, Save the call → `logCall('c-tom', { said, day: { ymd, words }, theirMove: true }, 'pipeline:…')`; the empty refusal), `waitingOnThem.test.ts` (a held row and its chip), `ThreadWindow.court.render.test.tsx` (the chip with a promise), the SQL test.

**Docs.** `docs/migrations/…`, `PROJECT_DOCUMENTATION.md` § Messages (the Call kind), GLOSSARY (*Call (reply box)*), `docs/MESSAGES_ARCHITECTURE.md` (the writes list gains `log_call`). Guide *reply to a person from their thread* gains *## Log a call* (the four steps, what the line reads, the day).

**Best we can do.** Should the form take a duration? No — nobody will type it. Should it offer the person's number to dial first (☎ then log)? Yes: the Call kind's header line shows **☎ Call (830) 555-0133** as a tel link above the fields, so the flow is dial, talk, log. Build it.

**Verify (Route B, no send).** On a ZZ customer waiting on us: pick Call, write, give a day, Their move, Save the call — the row leaves Needs a reply, the thread's chip reads their move until the day, Waiting on them holds the row with the day. `supabase db push` the migration after the PR merges (the client works before the push: the Call kind shows but Save answers the RPC's absence with the box's error line — deploy the client first anyway, then push, same hour).

### PR 8 — A lead's doors (M)

**Goal.** On a lead's thread (above the words) and on their Needs a reply row: **Book a visit** (Add Job with the lead's name, number, email and words filled) and **Start an estimate** (a customer made from the lead, the thread kept, a new estimate opened on them). Either takes them off Leads.

**Decision.** Both (decision 5). "Add to Prospects" stays unbuilt (no caller today; the lead stays on Messages until booked — the owner's R8 lean).

**Files.**
- **new** `src/lib/messages/leadDoors.ts` — `LEAD_DOOR_WORDS` (*Book a visit*, *Start an estimate*, the hint *Either takes them off Leads.*, the toasts *Lena is a customer now. Her thread came with her.*), `leadFacts(contact, lines) → { name, phone, email, words }` (the newest inbound line's body as the words), `customerPayloadFrom(facts, ownerUserId, today) → NewCustomerFormPayload`, `jobPrefillFrom(facts) → NewJobCustomerPrefill`.
- **new** `src/lib/messages/leadDoorsIo.ts` — `convertLeadToCustomer(contactId, facts, client) → { customerId }`: insert `customers` (the payload above; `master_user_id` via `resolveCompanyOwnerUserId`), then `nameContact(contactId, { record: { table: 'customers', id }, kind: 'customer' })` (**not** `contactForCustomer`, §1.2), return the id. One function, used by both doors.
- `src/contexts/JobFormModalContext.tsx` + `src/components/jobs/JobFormModal.tsx` — `OpenNewJobOptions.prefillCustomer?: { name; phone?; email?; note? }`; apply it in a new effect beside the `newJobProjectId` one (`setCustomerName/Phone/Email`; the note goes into the job name's placeholder or the first specific-work line — read the form; recommended: `setJobName(note)` trimmed to 60 chars, since the form has no notes field). **Book a visit** = `convertLeadToCustomer` first (so the job's customer picker finds them), then `openNewJob({ prefillCustomer, onSaved: reread })`.
- `src/pages/Estimates.tsx` — `?newEstimate=true&customer=<id>`: `createDraft` takes `customerId` and inserts it (as `QuickEstimateWizard` does). **Start an estimate** = `convertLeadToCustomer`, then `navigate('/estimates?newEstimate=true&customer=' + id)`.
- **new** `src/components/messages/useLeadDoorThreadSlots.tsx` — a slot hook modelled on `useEstimateDoorThreadSlots` filling `aboveLines` only when `c.kind === 'lead'` with the two buttons (+ the hint); merged in `threadSlots.tsx`.
- `src/lib/followUp/queue.ts` `needsReply()` — for `c.kind === 'lead'` the acts are `['Reply', 'Book a visit', 'Start an estimate', 'No reply needed', 'Remind me Monday']`; `FollowUpSections.tsx` `ReplyRowView` routes the two to `actions.bookVisit?(contactId)` / `actions.startEstimate?(contactId)`; `FollowUpPanel.tsx` builds them (it has `me`, the io, `say`); `KIND_WORDS` gains `lead: 'lead'` so the sub-line reads.
- `Messages.tsx` — nothing (the panel owns the actions).

**Tests.** `leadDoors.test.ts` (facts from a thread; the payload; plain words), `leadDoorsIo.test.ts` (insert then `name_contact` with the record; never `contact_for_customer`), `useLeadDoorThreadSlots.render.test.tsx` (a lead gets the two buttons; a customer does not), `FollowUpPanel.render.test.tsx` (a lead's row acts), `JobFormModal` smoke (prefillCustomer fills the three fields), `Estimates` deep-link test (customer id on the draft).

**Docs.** Guide *sort-new-messages* § Who is this? (*A lead stays on Messages until you book them…* + the two doors), guide *find every message with a person in one place* (the lead's doors above the words), GLOSSARY *Lead*, PROJECT_DOCUMENTATION § Messages, `docs/twins/APP_DIRECTORY.md` only if a route is added (none is).

**Best we can do.** Converting on **Start an estimate** before the estimate is saved can leave a customer with no estimate if they close the page. Acceptable (a customer record with their words is still true), but say it in the fragment. Alternative: convert on the estimate's first save — more code across the Estimates page; not recommended.

**Verify (Route B, no send).** Seed a ZZ lead (an inbound text from an unknown number, named as a lead through Who is this?). Book a visit → Add Job opens filled; cancel. Start an estimate → the customer exists, the thread shows under their name, the estimate opens on them. Delete the ZZ rows after.

### PR 9 — One front door; the guides (S)

**Goal.** GC projects → Messages becomes a link to `/messages?kind=trade` (the pill only; `/gc?view=messages&thread=…` keeps working for every existing link). The thread guide's stale closing section ("Calls and texts join it in a later update") goes. The Messages guide gets a final read for the new words (Show, Answer all, the strip, the switch card, Log a call, the lead's doors) in plain words.

**Files.** `src/pages/GcProjects.tsx` (~939 `devPill('messages', …)` → a `Link`; keep `devView === 'messages'` rendering for the thread param), `src/content/help/find-every-message-with-a-person-in-one-place.md` (§ *Open Messages* says `/messages`; drop the last section), `answer-everyone-waiting-on-us-from-one-page.md`, `GLOSSARY.md`, `PROJECT_DOCUMENTATION.md`, `docs/MESSAGES_ARCHITECTURE.md` (one Messages page).

**Tests.** `helpGuideContent.test.ts` / `helpGuidePlainWords.test.ts` / `helpGuideLinks.guides.test.ts` run in CI; `GcProjects` smoke for the pill's href.

**Best we can do.** Leave `/gc?view=messages` rendering `GcMessages` for one more release (the push links are in the wild), say so in the fragment, and file a one-line to-do to remove it.

---

## 3. The live test (after the train is on main)

Route B: the session sets up and reads; **a human presses every Send**. The point of this walk is the loop, both halves of it: a send goes out, the reply comes back **by email to an address we own** and lands in the thread through the team inbox, and a text goes out **to a phone we carry** and the reply from that phone lands in the thread through the Quo webhook (live since 2026-10-14). The ZZ customer is therefore *us*: the team inbox's address and the owner's own cell.

1. **Switches** (the owner, Settings → Phone and texts): the team inbox address set to an address the office owns and can reply from (the owner's call: team@ or office@); Reply push on; Read bids@ on; Office hours saved; Flows → residential `approved` and `paid` set to Offers. The switch card on Messages should then read *8 of 8 on* and disappear.
2. **The ZZ customer**: name *ZZ Walk Messages Desk*, email = **the team inbox's own address** (so a reply from it comes straight back to the thread), phone = **the owner's own cell** (so the text lands in his hand and his reply comes back to the company number; never a Quo seat's number, which is the sender). Make it in the app as the sample assistant (`sample-assistant@samples.pipetooling.local`, minted with dev-login: `curl -s -X POST https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/dev-login -H "X-Dev-Login-Secret: $VITE_DEV_LOGIN_SECRET" -H "Content-Type: application/json" -d '{"email":"sample-assistant@samples.pipetooling.local","redirectTo":"https://clicktooling.com/messages"}'`; the link is one-shot; `VITE_DEV_LOGIN_SECRET` is in the main checkout's `.env.local`). Prod is clicktooling.com.
3. **An estimate** on them, sent through the Tell the customer sheet (the human presses **Send both** or **Email only**). Check: Went out shows the email (and the text, delivered); the thread shows the 📄 door.
4. **Open the link** from the received email (the human, from the inbox): the thread gets *👀 … opened estimate #N*; the strip's Estimates tile counts 1 sent · 1 opened.
5. **Reply by email** from the team inbox to the estimate email (*"Can you do it Thursday?"*): within three minutes (gmail-sync's cron) the line lands in the thread, the person shows in **New → Needs a reply** (or straight in Needs a reply, since they are a known customer with a holder), the strip's longest-wait tile names them. **This is the proof of lever 1.**
5b. **Reply by text** from the owner's cell to the company number (*"Thursday works"*): within a minute the Quo webhook lands it in the thread; the sent text above it reads **✓ delivered**; the person is back in Needs a reply. Then **STOP** from that phone once, to see the thread's opt-out line and the Nudge fall to email (PR 4's test), and **START** to undo it.
6. **Answer all**: the human walks it; the reply goes (Send as email); the end card shows 1 email. The email arrives in the inbox.
7. **Log a call**: Call → *They said: Thursday works* → a day → Their move → Save the call. The row is gone from Needs a reply; the chip reads *Their move · until …*; Waiting on them holds the row with the day.
8. **Nudge**: wait two days, or seed an older `out` line by SQL (the pooler recipe: `supabase/.temp/pooler-url`, user `postgres.yewfzhbofbbyvkvtaatw`, `$SUPABASE_DB_PASSWORD`; direct INSERT into `messages` is revoked from signed-in users, so inbound/older lines are seeded this way only); Nudge → the send window with the step's words → the human sends → Went out.
9. **Show: Mine** after Take it on the row.
10. **Clean up** the ZZ rows (customer, contact + channels, messages, estimate + its sent copies, the job if booked, `contact_owed`, `message_promises`) — a prod delete, the owner's or an authorized session's; `email_send_log` keeps the real sends. The owner's cell stays on no other customer: check `contact_channels` for the number before the delete, since a number joined to a ZZ contact and later to a real one would merge their threads.

What a classifier may refuse in a helper session: prod reads by psql, JS-driven presses on prod writes. UI clicks the owner makes in their own browser pass. Run the write steps from the session where the owner gave the word.

---

## 4. Not carried (file as to-dos when the train ships)

- The after-hours auto-answer (`afterHoursAnswer()` has no caller; its words are code, not on What customers see).
- "Add to Prospects" from a lead's thread (pure kernel `src/lib/prospects/leadThread.ts`, no caller).
- "Call back in Quo" (always disabled; the seats don't turn it on).
- `/gc?view=messages` rendering `GcMessages` (kept one release for the push links).
- A "not delivered" filter on Went out (the red rows + the strip's door cover it).
- A Dashboard tile for *answered within an hour* (the strip is on Messages first).
- The tech's "texts until" on the Office hours card.
