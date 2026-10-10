# P5: the trade's half of the job (Portal lane)

The plan for P5c of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, item 11), written at the lead's ask on 2026-10-10. Building's lane has shipped the SQL for everything a trade does on a job we are building. Eight `gc_trade_*` verbs are on main and on prod, granted to the service role, each taking the link's company first. No portal kind calls any of them yet:

| Verb | Lane, migration | What the trade does |
|---|---|---|
| `gc_trade_punch_fixed(company, item)` | U3b-i, `20261010049000` | says a punch item is fixed |
| `gc_trade_submittal_send(company, submittal, file_name, drive_url, note)` | U4a, `20261010005000` | sends a submittal round |
| `gc_trade_rfi_ask(company, package, question, sheets)` | U5a, `20261010012000` | asks a question while we build |
| `gc_trade_sow_report(company, package, line, pct)` | U6a, `20261010021000` | reports a line's percent done |
| `gc_trade_pay_app(company, package, app)` | U6a | sends its pay application |
| `gc_trade_unconditional_waiver(company, draw)` | U6a | signs the unconditional waiver for a paid draw |
| `gc_trade_sign_change(company, change_order)` | U6a | signs a change order we sent it |
| `gc_trade_final_pay_app(company, package, app)` | U6c, `20261010041000` | sends its final pay application, the retainage back |

Eleven of their refusal keys wait for P5 in `gcTradeSubmit.test.ts`'s `WAITING`: `fileNeeded`, `notYourMove`, `jobNotBuilding`, `sowNotSigned`, `drawWaiting`, `nothingToBill`, `splitLine`, `notPaidYet`, `finalSent`, `finalNotYet` and `punchNotOpen`. U6d (v2.5127) left two emails to the Portal: one when we accept the trade's work and ask for its final pay application, and one when its final pay application came in.

**The logic and the words are already on main.** The spike's `gcBuilding*.ts` and `gcPortalI18n.ts` only re-export from `src/lib/gc/`:

- the kernels: `submittalRowsOn` and `submittalState` (`buildingSubmittals.ts`); `portalCanAskRfi`, `portalRfis`, `rfiLabel`, `rfiNeededBy`, `rfiState` and `rfiDefaultHolds` (`buildingRfis.ts`); `punchItems`, `punchCounts` and `punchState` (`buildingPunch.ts`); and in `building.ts`, `payApplication`, `payAppSteps`, `newPayAppDraft`, `resendPayAppDraft`, `sentBackOpen`, `finalPayApplication`, `payApplicationForDraw`, `drawMoney`, `drawLinesOf`, `tradeChangesFor` and `tradeCloseout`; plus `portalOnSite` (`portal.ts`) and `sowMoney`;
- the words: every `bw` key in `buildingWords.ts` (the pay application window, the punch and submittal boxes) and the portal's `rfi*`, `report*`, `draw*`, `todo*` and `paper*` keys in `portalI18n.ts`.

**What P5 adds**: the job's Building rows in the slice and the mapper; the eight kinds on `submit-gc-trade-portal` with the eleven keys' statuses and words; the trade's screens, lifted from the spike's components; the two emails; and the flip of `DRAW_PORTAL_LIVE`.

**Not in P5c** (each keeps its own step in `PORTAL_REAL_BUILD.md`):

- **P5a, files.** A trade's upload into Drive needs a byte upload `_shared/driveUpload.ts` does not have (it uploads only from a URL). Until P5a a submittal's file is its name and, if the trade has one, a Drive link it types.
- **P5b, the company's own papers** (insurance, the W-9, the vetting form).
- **P5d, the schedule's kinds**, including `report_part` with the schedule's PR 16. Until then a split line reads its percent and takes no press (decision 6).
- **P5e, the bid tab.**
- `tradeRequestDraw` and `tradeSendWarranty` are gone: nothing presses them on the spike, and U6's call 5 dropped them.

It comes as five PRs (*The PRs, in order*). One small migration widens two CHECKs. Everything else is code.

## Who owns what (the seams)

| Piece | Owner | When |
|---|---|---|
| The eight verbs, their tables and their beds | Building (U3b-i, U4a, U5a, U6a, U6c) | on main and prod |
| The office's windows (Punch list, Submittals, RFIs, Draws, Closeout) and their office-side presses | Building | on main |
| The slice, the mapper, the kinds, the trade's screens | Portal (P5c-1 to P5c-3) | this plan |
| The accept and final-came-in emails, their kinds and builders | Portal (P5c-4) | this plan |
| The ticks that send those two emails, in Building's Closeout and Draws windows | Building calls P5c-4's builders | after P5c-4 |
| `DRAW_PORTAL_LIVE`, and the two office hints that read it (`GcDrawForms.tsx`, `GcDrawsWindow.tsx`) | Portal flips it in P5c-3 | P5c-3 |
| `report_part` on a split line | Schedule PR 16 with the Portal's P5d | later |
| The money team's read of the Building tables | Owner Billing (O9, on main) | done |

## What a trade sees on its job

The page's job branch (`awardedToMe` in `GcTradePortalProject.tsx`) today draws the statement of work, then the charges and the changes. P5 adds, in the prototype's order and under the statement of work:

1. **Your report** (`reportTitle`, anchored `report:<pkg>`): the on-site line, then each line with its amount, `paidThrough` and a percent picker that never goes below what was billed. A split line shows its percent as text with `splitLine`'s words. The pay application door follows it.
2. **The pay application door**, the spike's `GcBuildingPayAppDoor`:
   - a failed inspection on its work (`inspFailed`);
   - **Punch list** (`GcBuildingPunchForTrade`): each open item with **It is fixed**;
   - **Submittals** (`GcBuildingSubmittalsForTrade`): each open one with its file name, an optional Drive link, a note and **Send**;
   - **Changes to sign**: each change we sent, what it adds or takes off, and **Sign the change**;
   - one state: **closing** (`CloseoutForTrade`), **waiting** (with us), **sent back** (`fixIt`, then **Fix and send again**), or **ready** (`canAsk`, then **Fill out the pay application**).
3. **The pay application window** (`GcBuildingPayAppWindow` with `viewer: 'trade'`): the four steps beside the G702/G703 paper (work, details, sign, send). The final pay application is the same window with no lines.
4. **Draws**: each with its net, what was asked, the charges taken off and its chip. A paid draw with a conditional waiver has **Sign the unconditional waiver**, and the final's has the final release.
5. **Questions while we build** (`GcPortalRfis`): its RFIs with their state and answer, and **Ask**.

The home's to-dos (`portalTodos`) are not on main yet. They lift with P5c-3, when their callees are all on main, as `PORTAL_REAL_BUILD.md` planned (*Kernels that move*).

## The slice (P5c-1)

`gc-trade-portal` reads the Building rows of **the trades awarded to this company**: packages whose `awarded_invite_id` is one of its own invites. That is the rule `awardOf` already applies. It is never the slice's whole `packageIds`, which holds every package it was asked to quote. `tradePortalSlice` holds them a second time and copies only the fields named in `TRADE_PORTAL_FIELDS`.

| List | From | Fields that pass | Never passes |
|---|---|---|---|
| `submittals` | `gc_submittals` | `id, project_id, package_id, number, title, kind, spec_section, lead_days, needed_by, asked_on` | `created_by` |
| `submittalRounds` | `gc_submittal_rounds` on those | `id, submittal_id, round, sent_on, sent_by, file_name, drive_url, note, to_architect_on, answered_on, answer, answer_note` | `recorded_by`, `email_send_log_id` |
| `rfis` | `gc_rfis` on its awarded trades | `id, project_id, package_id, number, question, sheets, asked_on, needed_days, sent_to_architect_on, answered_on, answer_text, answered_by, impact, days`, and `mine` (`asked_by_company_id` is the company) | `cost`, `change_order_id`, `recorded_by`, `email_send_log_id`, who asked; an RFI on our own work (`package_id` null) |
| `rfiHolds`, `submittalHolds` | `gc_rfi_holds`, `gc_submittal_holds` on those | `*_id, scope_item_id` | |
| `punch` | `gc_punch_items`, `removed_at` null | `id, project_id, package_id, position, text, where_on, photo_url, added_on, fixed_on, checked_on, sent_back_times, sent_back_note, sent_back_on` | `added_by`, `checked_by`, a removed item |
| `draws` | `gc_draws` on its signed statements of work | `id, sow_id, number, seq, requested_on, status, gross, retainage, net, final, waiver, waiver_on, approved_on, paid_on, asked, sent_back_on, sent_back_note, period_to, address, license, signed_by, signed_title, signed_on, file_name, drive_url` | `recorded_by` |
| `drawLines` | `gc_draw_lines` | `draw_id, sow_line_id, to_pct, stored, we_see` | |
| `lineReports` | `gc_sow_line_reports`, the newest per line | `sow_line_id, pct, reported_on` | `recorded_by`, `company_id` |
| `changeSends` | `gc_change_order_trade_sends` on its statements of work | `change_order_id, sow_id, sent_on, signed_on, sow_line_id` | `sent_by`, `recorded_by` |
| `changeOrders` (widened) | `gc_change_orders` for its requests and for changes sent to it | `id, number, status, sent_on, answered_on, cost`, and `description` on a change sent to it | `price`, `pct_done`, `schedule_words`, `answered_how`, `days_on_chart`, `plan_set_id`, `created_by` |
| `sows` (widened) | | `accepted_on` | the signer's fields |
| `gc` (widened) | | `closed_on` | |

`description` passes only on a change sent to the trade, because `gc_trade_sign_change` already names its new line `Change order N: <description>` and the `change` email quotes it. The customer's retainage day (`gc_owner_retainage_paid_on`) never passes. A trade reads that its retainage comes 10 days after the customer pays us, never the day itself.

**The mapper** (`tradePortalState.ts`) fills what it leaves empty today: `GcProject.submittals`, `rfis`, `punch` and `closedOn`; `Sow.draws`, `acceptedOn` and `sentBack`; each `SovLine`'s `pctReported` (newest report) and `pctBilled` (from the paid and approved draws, as `drawRows.ts` reads it on the office side); and `ChangeOrder.tradeChange` with its `description`. Where Building's office mapper (`drawRows.ts`, `punchRows.ts`, `submittalRows.ts`, `rfiRows.ts`, `closeoutRows.ts`) already maps a row, the portal calls the same function, as `backChargeOf` and `changeRequestFromRow` are shared today. There is never a second mapper.

**The never-sees test** plants a marked value in each field above that must not pass, plus a punch item taken off, another company's draw, submittal and RFI, an RFI on our own work, and a change order's price. None may appear in the slice's JSON.

## The kinds (P5c-2 and P5c-3)

Each kind is the verb's own suffix, as every kind is today (`answer_back_charge`, `ask_change`, `sign_sow`). That supersedes U4's `send_submittal` and U5's `ask_rfi` (decision 1).

| Kind | Fields | Under the hourly cap | PR |
|---|---|---|---|
| `punch_fixed` | `itemId` | no | P5c-2 |
| `submittal_send` | `submittalId`, `fileName`, `driveUrl?` (https only), `note?` | yes | P5c-2 |
| `rfi_ask` | `packageId`, `question`, `sheets[]` | yes | P5c-2 |
| `sow_report` | `packageId`, `line` (the kernels' `SovLine.id`), `pct` (0 to 100) | no | P5c-3 |
| `pay_app` | `packageId`, `app`: `lines[{line, toPct, stored?}]`, `periodTo`, `signedBy`, `signedTitle?`, `address?`, `license?`, plus `esignConsent` | no (`drawWaiting` holds a repeat) | P5c-3 |
| `final_pay_app` | `packageId`, `app`: `periodTo`, `signedBy`, `signedTitle?`, `address?`, `license?`, plus `esignConsent` | no (`finalSent` holds a repeat) | P5c-3 |
| `unconditional_waiver` | `drawId`, `printedName`, `esignConsent` | no (`alreadySigned`) | P5c-3 |
| `sign_change` | `changeOrderId`, `printedName`, `esignConsent` | no (`alreadySigned`) | P5c-3 |

The hourly cap's count (`freeTextCounts`) gains the company's RFIs (`gc_rfis.asked_by_company_id`) and its submittal rounds (`sent_by` = trade, on its submittals) in the last hour.

**The keys, with their statuses and words** (EN and ES, in `portalI18n.ts` and `TRADE_ERROR_WORDS`):

| Key | Status | Raised by | Words (EN) |
|---|---|---|---|
| `punchNotOpen` | 409 | punch_fixed | That item is marked fixed already. Reload the page. |
| `notYourMove` | 409 | submittal_send | That submittal is with us or the architect now. Reload the page. |
| `fileNeeded` | 400 | submittal_send | Type the name of the file you are sending. |
| `jobNotBuilding` | 409 | rfi_ask, sow_report, pay_app, final_pay_app, punch_fixed | That opens once we are building the job. |
| `sowNotSigned` | 409 | sow_report, pay_app, final_pay_app | Sign your statement of work first. |
| `splitLine` | 409 | sow_report | That line is split into parts. Tell us each part's progress. |
| `drawWaiting` | 409 | pay_app, final_pay_app | Your last pay application is still with us. |
| `nothingToBill` | 409 | pay_app, final_pay_app | Nothing new to bill since your last pay application. |
| `notPaidYet` | 409 | unconditional_waiver | The unconditional waiver comes after we pay the draw. |
| `finalSent` | 409 | final_pay_app | Your final pay application went already. |
| `finalNotYet` | 409 | final_pay_app | The final pay application opens once every line is billed and the work is accepted. |

**The guard learns the helpers.** Its regex reads only `gc_trade_*` bodies, so `finalSent`, `finalNotYet` and `punchNotOpen`, raised inside `gc_final_pay_app_ask` and `gc_punch_fixed_ask`, are not checked. P5c-2 widens it to the `*_ask` functions a trade verb returns through, and the test fails until each key is mapped.

**A signature** (`pay_app`, `final_pay_app`, `unconditional_waiver`, `sign_change`) does what `sign_sow` does around the write. No consent is `consentNeeded` before any write. After the verb, `recordEsignConsent` writes the ledger row with the function's time, the printed name, the method `type`, the IP and the browser (decision 5).

## The emails (P5c-4)

Both are new kinds on `gc-trade-email`, in the **pay** group, keyed by the statement of work so a repeat sends nothing:

- **`accepted`** (`<sow id>:accepted`): we accepted the work, here is what is left. It asks for the final pay application, in `todoFinal`'s words, with the day the retainage comes back once the customer pays (never the customer's day).
- **`finalIn`** (`<draw id>:finalIn`): your final pay application came in, and what happens next: the retainage after the customer pays us, then the final release to sign in the portal.

The builders go in `src/lib/gc/closeoutEmail.ts` beside `drawEmail.ts`, each built with `pt()` in the company's language. Building's Closeout window (U6d, `gc_accept_work`) and its Draws window (a final that came in by email, `gc_final_pay_app_came_in`) call them through `emailTheTrade` with their ticks. The ticks start off and show only to `canSendGcTradeEmail`, as every GC send does. A final the trade sends from its portal needs no email: the portal shows it as sent.

Each kind follows #4815's checklist: `TRADE_EMAIL_KINDS` and `KIND_GROUP` in `_shared/gcTradeEmail.ts`, `PortalMessage['kind']` and `KIND_GROUP` in `portal.ts`, the journey step's sample email, and the sent copy.

## The migration (P5c-m)

One migration, cut first and pushed in a batch. It changes no table and adds no function, so it needs no `apply_*` call:

- `gc_trade_messages_kind_known` gains `accepted` and `finalIn` (and `punch` if the owner takes decision 7);
- `esign_consents`' record-type CHECK gains `gc_draw` (a pay application or a waiver, keyed by the draw) and `gc_trade_change` (keyed by the change order).

Each is a drop and re-add of one CHECK, `NOT VALID` then `VALIDATE`, under the lock timeout. P5c-3 and P5c-4 need it on prod before they merge. They do not need a types regen, since a CHECK is not in the types.

## The PRs, in order

Each is cut from `origin/main` once the one before it is in, with its version claimed at the cut, its release note, fragment and docs, and `gh pr merge <n> --auto`. The lead deploys `gc-trade-portal` and `submit-gc-trade-portal` after each that touches them. *Check* is how the lead sees it work. Every press on prod waits for the owner's yes.

0. **P5c-m, the two CHECKs** (migration). *Check:* the doc's steps read both CHECKs, and an insert with an unknown kind is refused, rolled back.
1. **P5c-1, the job's work, read only** (no migration). The slice's new lists, the mapper, the never-sees test, the sample job's rows (a punch item, a submittal, an RFI, a paid draw), and the trade's screens drawn with no presses. A block whose kind is not live is hidden, as `PORTAL_REAL_BUILD.md` rules. *Check:* on the test company's link, the building test project's job shows its punch list, submittals, RFIs and draws as the office's windows hold them, and another company's link shows none of them.
2. **P5c-2, punch, submittals and questions** (no migration). The kinds `punch_fixed`, `submittal_send` and `rfi_ask`, their four keys, the cap's two counts, the guard's wider regex, and the presses in the punch list, submittals and RFI blocks. *Check:* the test company marks a punch item fixed, and the office's Punch list reads it. It sends a submittal round with a file name, and the Submittals window has round 2. It asks a question, and the RFIs window has it with the company's name.
3. **P5c-3, report, pay and sign** (after P5c-m on prod). The kinds `sow_report`, `pay_app`, `final_pay_app`, `unconditional_waiver` and `sign_change`, their seven keys, the signatures' ledger rows, the report block, the pay application door and window (`viewer: 'trade'`), the draws list, the closeout checklist, and the home's to-dos. `DRAW_PORTAL_LIVE` turns true, so the `paid` email carries its waiver line, the `change` email sends, and the two office hints change. *Check:* the test company reports a line, sends a pay application, and the Draws window has it to approve. After the office pays it, the company signs the unconditional waiver. A change sent to it is signed and becomes a line. On an accepted job, its final pay application asks back the retainage.
4. **P5c-4, the two emails** (after P5c-m on prod). The builders, the kinds, the journey samples, and Building's two ticks wired to them. *Check:* each email reaches the test inbox on the owner's yes and reads the same on What customers see. The same press twice sends once.

## Tests

- **P5c-1**: the never-sees test; the mapper (`pctReported`, `pctBilled`, draws in `seq` order, a sent-back draw, a change sent and signed); the page drawn read only for a job with each kind of row.
- **P5c-2**: `parseTradeSubmit` for the three kinds (an https-only Drive link, a blank file name reaching the SQL, sheets trimmed); the cap's counts; the guard reading the `*_ask` helpers; the page's presses posting their bodies; a refusal in the company's words; the preview posting nothing.
- **P5c-3**: `parseTradeSubmit` for the five kinds (a pay application's lines, a stored amount, no consent); the page's report picker never offering below billed; the pay application window's steps; each signature posting its consent; the flip in `drawEmail.test.ts`.
- **P5c-4**: each builder in both languages, its key, and its journey sample.

## Docs

- `EDGE_FUNCTIONS.md`: `gc-trade-portal`'s new lists (P5c-1); `submit-gc-trade-portal`'s eight kinds and keys (P5c-2, P5c-3); `gc-trade-email`'s two kinds (P5c-4).
- `ACCESS_CONTROL.md`: the trade portal's lines for each new read and write.
- `PROJECT_DOCUMENTATION.md`'s trade portal paragraph; `GLOSSARY.md` (pay application, unconditional waiver and final release as the trade sees them).
- The guides: `share-a-trade-partner-its-portal` (what the trade can do, in each PR); Building's `pay-a-trades-draw`, `keep-a-trades-punch-list`, `send-a-trades-submittal-to-the-architect` and `ask-the-architect-a-question-while-we-build`, where they say the portal cannot do it yet.
- `docs/migrations/<stamp>_gc_portal_p5_checks.md` (P5c-m). A release note and fragment for each PR.

## The live check

Every press writes prod, and P5c-3 and P5c-4 send email. Each waits for the owner's yes typed in the pressing helper's own chat. The walk uses the building test project, its test company's link and the test inbox. The office's side of each step is a dev on `/gc`.

## Decisions (defaults; say if any is wrong)

1. **Kind names are the verbs' suffixes**: `punch_fixed`, `submittal_send`, `rfi_ask`, `sow_report`, `pay_app`, `final_pay_app`, `unconditional_waiver`, `sign_change`. It is the rule every kind follows. U4's and U5's `send_submittal` and `ask_rfi` were written before it was settled.
2. **The statuses**: 409 for a state, 400 for a field, as the table above. They are the plans' own where U4, U5 and U3b named one.
3. **The Building rows pass only for trades awarded to the company**, by `awarded_invite_id`, never the asked packages. An RFI on our own work never passes.
4. **A submittal's file stays a typed name and an optional Drive link until P5a.** When P5a lands, a submittal's upload goes to the job's **Submittals** folder (Building's decision 6), and every other upload to *Team only → From trades → <company>* (this plan's decision 9). The two plans' folders are reconciled that way.
5. **The four signatures get the e-sign consent and a ledger row**, as `sign_sow` does. That covers the pay application, the final pay application, the unconditional waiver and a change order. The SQL keeps its acts (`waiver_on`, `signed_on`, the draw's `signed_by`). The consent and its words are the ledger's (`esign_consents`, record types `gc_draw` and `gc_trade_change`), so no table changes. *The other way:* plain presses, as the SQL and the prototype have them. Not taken, because a lien waiver releases a legal claim (owner's call 2 below).
6. **A split line takes no report until P5d.** It reads its percent with `splitLine`'s words. `GcPortalPartRows` stays on the spike's `GcSplitBars.proto.tsx` until the schedule's PR 16.
7. **The punch list's emails** (an item added, an item sent back), which U3b's seams gave the Portal, are *not* in P5c-4 by default. The page shows both, and Building's window does not send yet. Say yes and they join P5c-4 as kind `punch`, keyed `<item id>:added` and `<item id>:back:<n>`.
8. **The home's to-dos** (`portalTodos`) and the pay page's kernels (`portalPay`, `portalPapers`, `portalJobMoney`) lift in P5c-3, word for word with `lift-same`. That is the hour their last callee is on main, as `PORTAL_REAL_BUILD.md`'s *Kernels that move* planned. `portalHome` and `portalMessages` follow when theirs are.
9. **The trade's screens are lifted, not redrawn.** `GcBuildingPayApp.tsx` (the door, the window, the closeout checklist), `GcBuildingPunch.tsx`'s and `GcBuildingSubmittals.tsx`'s trade halves, and `GcPortalRfis.tsx` move to main with `dispatch` swapped for the submit adapter, as P1b did. The spike's follow-up re-exports them. Their office halves are already Building's on main.
10. **`DRAW_PORTAL_LIVE` flips in P5c-3**, the PR that ships the screens, as `SOW_SIGN_SCREEN_LIVE` did for P2c-ii.

## The owner's calls

1. **The live checks**: the owner's yes, typed in the helper's own chat, before any press on the test link and before either email.
2. **A trade's lien waiver signed in the portal** (decision 5): typed name and e-sign consent, recorded in the ledger, with the waiver's words on the page. The statutory form as a PDF comes with P5a.
3. **The punch list's emails** (decision 7): default not yet.

## Is this the best we can do?

Three ways it could be better:

1. **One job view built on the server.** `gc-trade-portal` could return the job already folded (report, draws, closeout) instead of rows the page maps. The payload would be smaller and the money rules would sit on the server. *My pick: not now.* The slice and its never-sees test are the boundary, and the kernels read the rows' shapes. It is the same call `PORTAL_REAL_BUILD.md` made.
2. **The statutory waiver as the signed paper.** The lien waiver train's four forms (`LienReleaseStepRow`) could fill the trade's waiver as a PDF it signs, as our own waivers are. *My pick: with P5a*, when the portal can store a file. P5c records the act and the consent.
3. **Fewer PRs.** P5c-2 and P5c-3 could be one. *My pick: two.* P5c-2 is three small presses that help the job today. P5c-3 is the pay application window, about a thousand lines lifted, and the flip. The window would hold the presses back if they shipped together.

## Status

Planned 2026-10-10 by gc 3 (the Portal lane) on `claude/gc-portal-p5-plan`, from `origin/spike/gc-mode` at fe1fe1ce2, over main at 982e95bb4. P2c-ii (v2.5138) is merged and its eight functions are deployed. Nothing built. It waits for the lead's read-back.
