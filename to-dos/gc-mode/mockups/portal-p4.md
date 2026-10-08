# P4: back-charges and a trade's change requests (Portal lane)

The plan for P4 of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, items 7 and 8). Two records belong to the portal:

- **A back-charge** is a charge to a trade: cleanup, damage, or work we had to finish for it. The company sees it in its portal and agrees or disputes it by its answer day.
- **A change request** is a trade asking us for a change: it hit something no one could see, the customer asked it for more, or the plans changed. The office makes it a change order to the customer or turns it down.

The kernels and their 81 words are already on main from P0:

- `backChargeState`, `backChargeCanTake`, `backChargeDraws`, `backChargesToAct` and `portalBackCharges`;
- `changeRequestState`, `openChangeRequests`, `portalCanAskChange` and `portalChangeRequests`;
- `BACK_CHARGE_ANSWER_DAYS` (5);
- the `bc*`, `cr*`, `mBc*` and `mCr*` keys.

What P4 adds is the tables, their SQL, the slice, the presses and the email words.

It comes as two PRs:

- **P4a**: the two tables, the office's three back-charge verbs, the trade's two verbs, and the doors registry. It is a migration and needs B6-a (#4973) on main.
- **P4b**: the slice, the two portal blocks and their presses, the email builders, the dashboard's two kernels, the sample and the docs. It goes after P4a's types.

## Who owns what (the seams)

| Piece | Owner | When |
|---|---|---|
| `gc_back_charges`, `gc_trade_change_requests`, the five verbs below | Portal (P4a) | after B6-a |
| The office screen that charges, keeps and drops a charge (`GcBuildingBackCharges` on the spike) | Building (Helper 4) | after P4a's types |
| Taking a charge off a draw (`gc_take_back_charge`, `taken_draw_id`'s FK) | Building (U6) | with the draws |
| `gc_draft_change_order_from_request`, `gc_turn_down_change_request`, the request list in the change orders window | Owner Billing (Helper 5) | after P4a's types |
| The trade signing the change it asked for (`gc_trade_sign_change`) | Building (U6) | with the draws |
| The award and the statement of work in the slice | Portal (P2c or P4b, whichever lands first) | after B6-a |
| The dashboard's Needs you line | Board (B2b) reads P4b's two kernels | B2b |

## P4a: the tables and their SQL

One migration, stamped at the cut. It is `SET lock_timeout = '3s';` first, idempotent, and ends with the three `apply_*` calls.

**`gc_back_charges`** (`BackCharge`):

- `id`, `project_id` (FK `gc_projects(project_id)`), `package_id` (FK, cascade), `company_id` (FK `gc_companies`, restrict).
- `sow_id` (FK `gc_sows`, restrict). The charge is on the work the company signed for.
- `amount` (> 0, cents kept), `reason` (not blank, at most 2,000), `photo_url` (a Drive link, null; no upload until P5a).
- `sent_on` (the app's day), and `answer_by` = `sent_on` + 5 days, held to `BACK_CHARGE_ANSWER_DAYS` by a test that reads the migration.
- `status` is one of `open`, `agreed`, `disputed`, `kept` or `dropped`.
- `answered_on` and `answer_note`: the company's answer, and its reason when it disputes.
- `settled_on`, `settled_note` and `settled_by`: the office's keep or drop.
- `taken_draw_id` (uuid, no FK until U6) and `taken_on`.
- `created_by` and `created_at`.
- CHECKs:
  - an answered status has its day;
  - a dispute has its note;
  - a kept or dropped charge has its day and note;
  - a taken charge has both its draw and its day.

**`gc_trade_change_requests`** (`TradeChangeRequest`):

- `id`, `project_id`, `package_id`, `company_id`, `sow_id`.
- `asked_on`, `description` (not blank, at most 2,000), and `reason` (`owner`, `field` or `plans`: the same CHECK as `gc_change_orders`).
- `amount` (> 0) and `days` (≥ 0).
- `file_url` (null until P5a).
- `change_order_id` (FK `gc_change_orders`, set null).
- `turned_down_on` and `turned_down_note`, with a CHECK that both are set together, never with a `change_order_id`.
- `created_at`.

**RLS and doors**: both tables are dev only (`is_dev()`), as `gc_trade_portal_links` is. The client has no insert or delete; the verbs below write.

- `doors.ts` gains both tables as `dev('Portal', PORTAL_OPENS)`, and `doors.test.ts` reads them from the migration.
- Owner Billing's two RPCs and Building's screen work under that policy, so they are dev only until the trade wave opens the tables.

**The office's verbs** (`SECURITY INVOKER`, so the policy is their gate). Refusals are `RAISE '<key>' USING ERRCODE 'P0001', DETAIL '<words>'`, as P2a's are.

- **`gc_back_charge(p_package_id, p_amount, p_reason, p_photo_url)`**: on the package's statement of work if it is signed, else `sowNotSigned`. The company comes from the statement of work. It refuses an amount that is not above zero and a blank reason. It returns the id.
- **`gc_keep_back_charge(p_id, p_note)`**: only a disputed charge, or an open one past its answer day (`noAnswer`). Never a taken one. The note is needed.
- **`gc_drop_back_charge(p_id, p_note)`**: any charge not dropped and not taken. The note is needed.

**The trade's verbs** (service role only, the link's company first, as P2a's):

- **`gc_trade_answer_back_charge(p_company_id, p_charge_id, p_agree, p_note)`**:
  - Its own charge, else `notYours`.
  - Open and not taken, else `alreadyAnswered`. An open charge can still be answered after its answer day.
  - A dispute needs its note (`noteNeeded`).
- **`gc_trade_ask_change(p_company_id, p_package_id, p_description, p_reason, p_amount, p_days)`**:
  - Only the company on a signed statement of work, on a job that is ours (`portalCanAskChange`'s rule), else `notAwarded`.
  - The description is needed (`descriptionNeeded`), the amount must be above zero, the days 0 or more, and the reason one of the three.

A new SQL refusal key joins `TRADE_SQL_ERRORS` with its status, and the portal's words for it (`TRADE_ERROR_WORDS`) in both languages, in P4b. The keys are `sowNotSigned`, `notAwarded`, `alreadyAnswered`, `noteNeeded` and `descriptionNeeded`.

**The check (P4a)**: the local PG15 bed, as P2a's, with the new keys and each CHECK. Then Helper 5 runs their two RPCs on the bed and writes the request's columns under dev RLS.

## P4b: the portal's side

**The slice** gains the company's own rows, never another company's, and each field joins `TRADE_PORTAL_FIELDS`:

- **Back-charges**: every field but `created_by` and `settled_by`.
- **Change requests**: every field.
- **For each request's change order**: its `number`, `status`, `sent_on`, `answered_on` and `cost`, which is "Your part", and once U6 lands, the trade's send and signature.
  - Never its `price`, the customer's side or our fee. The never-sees test plants a price of 777,777 on the change order.
- **The award and the statement of work**, if P2c has not brought them yet:
  - the company's own award (`awarded_invite_id` only when it is theirs);
  - its statement of work's `status`, `signed_on`, `price` (its own number) and `retainage_pct`.

The mapper (`tradePortalState.ts`) then fills `pkg.awardedInviteId`, `pkg.sow`, `sow.backCharges`, `project.changeRequests` and the change orders' trade-side fields. The kernels on main read them unchanged.

**The blocks**, ports of the spike's `GcPortalBackCharges` and `GcPortalChanges`, on the project page of a trade that is theirs:

- **Charges from Click** lists each charge with its photo link. Its chip and words come from `portalBackCharges`. An open one offers **Agree** and **Dispute it**, and a dispute takes its reason.
- **Changes to your work** lists each request with `portalChangeRequests`' chip and words, and offers **Ask for a change** while `portalCanAskChange` holds. The form has what changed, why (the three reasons), the amount and the working days. The file is hidden until P5a, as the quote form's is.

**The presses**: `submit-gc-trade-portal` gains two kinds:

- `answer_back_charge` takes `chargeId`, `agree` and `note`.
- `ask_change` takes `packageId`, `description`, `reason`, `amount` and `days`.

`ask_change` joins the free-text kinds under the cap of 10 an hour; the count adds the company's change requests from the last hour. `answer_back_charge` can only happen once per charge, so it is not capped. The page re-reads quietly, as P2b-ii's presses do, and the preview posts nothing.

**The emails** (no trade press emails the trade). `tradeEmail.ts` gains two builders from the spike's `portalMessages`, and the office screens call `gc-trade-email` with them:

- **`backChargeEmail(stage, …)`**, kind `backCharge` (pay):
  - `sent` (`mBcSubject`, `mBcWhat`, `mBcAnswer`, `mBcOpen`), key `<charge id>:sent`;
  - `settled` (`mBcKept…` or `mBcDropped…`), key `<charge id>:settled`;
  - `taken` (`mBcTaken…`), key `<charge id>:taken`. That one is U6's to press.
- **`changeAskEmail(stage, …)`**, kind `changeAsk` (contracts):
  - `down` (`mCrDown…`), key `<request id>:down`;
  - `sent` (`mCrSent…`, with its part), key `<request id>:sent`;
  - `no` (`mCrNo…`), key `<request id>:no`.
- Building's screen sends `sent` and `settled`. Owner Billing's answers send `down`, `sent` and `no`.

**The dashboard**: the spike's `gcBackChargesWaiting.ts` and `gcChangeRequestsWaiting.ts` are lifted to `src/lib/gc/`, with their tests and `BACK_CHARGE_LATE_DAYS` (7). The Needs you line itself is the Board's B2b, which reads them. Until then the office sees each on its own screen.

**The sample**: the sample company gains a second sample project that is ours, with its award, a signed statement of work, one open back-charge with a photo link, and one change request with the customer. What customers see then shows both blocks. The sample's ids stay uuids, and a sample press answers ok and writes nothing.

## Errors, as keys

| Key | Status | When |
|---|---|---|
| `sowNotSigned` | 409 | the office charges a package with no signed statement of work |
| `notAwarded` | 409 | a company asks for a change on work that is not its signed statement of work |
| `alreadyAnswered` | 409 | a charge that is not open, or is taken |
| `noteNeeded` | 400 | a dispute, a keep or a drop with no note |
| `descriptionNeeded` | 400 | a change request with no words |
| `amountNeeded` | 400 | (exists) an amount not above zero |
| `notYours` | 409 | (exists) another company's charge or package |

## Tests

- **P4a**:
  - the SQL bed's scenario, with each refusal and each CHECK;
  - `doors.test.ts` with the two tables;
  - a test that the migration's answer days equal `BACK_CHARGE_ANSWER_DAYS`.
- **P4b**:
  - **Slice and mapper**: the slice's never-sees test with the change order's price planted; the mapper filling `sow.backCharges` and `changeRequests`.
  - **Submit function**: `parseTradeSubmit`'s two kinds, good and bad; the cap counting change requests.
  - **Portal blocks**: render tests for agree, dispute and its note, the ask form, and the preview posting nothing.
  - **Emails**: `gcTradeEmail.test.ts`'s cases for the two builders' words, keys and groups.
  - **Dashboard**: the two lifted waiting kernels' tests.
  - **Sample**: the sample's two blocks.

## Docs

- **P4a**: the migration's doc with its Status, ACCESS_CONTROL's trade portal section (who writes each table), GLOSSARY's back-charge and change request, a release note and its fragment.
- **P4b**:
  - EDGE_FUNCTIONS for the two kinds, and `gc-trade-email`'s two new kinds of words;
  - PROJECT_DOCUMENTATION's portal paragraph;
  - the guides `see-what-a-trade-partner-sends-from-its-portal` (a dispute, a change request) and `share-a-trade-partner-its-portal` (what it can do);
  - a release note and its fragment.
- The office guides ("charge a trade partner for cleanup or damage", "answer a trade partner's change request") ship with the screens that hold those presses: Building's and Owner Billing's.

## The live check

- **P4a**: the lead pushes the migration. Helper 5's two RPCs run against it on the test project under dev RLS.
- **P4b**, once Building's screen is in, the prototype's Iron Horse walk on the test company:
  1. charged $1,250;
  2. disputed in the portal with a note;
  3. the Needs you count after 7 days (or the kernel on a moved day);
  4. kept with a note;
  5. the `settled` email.
  A change request is asked in the portal, appears on Owner Billing's list with only "Your part" on the trade's side, and is turned down, with its `down` email. The live emails wait on call 3 as every send does.

## Decisions (defaults; say if any is wrong)

1. **P4a waits for B6-a.** A charge and a request hang on a signed statement of work (`gc_sows`).
2. **Both tables stay dev only** until the trade wave, in `doors.ts`. The office verbs are `SECURITY INVOKER`.
3. **Taking a charge off a draw is U6's**, including `taken_draw_id`'s FK. P4a leaves the columns.
4. **The office screens are their lanes'**: Building's for charges, Owner Billing's for requests. P4b builds only the portal's side, plus the email builders those screens call.
5. **The Needs you line is the Board's B2b**, reading P4b's two lifted kernels.
6. **No files until P5a**: a photo is a typed Drive link, and a change request carries none.
7. **The award and the statement of work join the slice** in whichever of P2c and P4b is cut first.
