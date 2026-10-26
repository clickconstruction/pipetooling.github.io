---
name: "Consistency sweeps: counted buttons, oldest first, a next press, a named reason"
number: 184
group: gated
status: proposed 2026-10-26 · the rules, the sites and one sweep per rule, with the mock-up; nothing swept yet
summary: >
  The owner named four conventions the newer surfaces follow and the older ones miss: a batch
  button says its count and holds nothing back, a waiting list reads oldest first with an age
  chip, an empty state names the next press, and an error names its reason. This to-do writes
  each as one sentence a script or a reviewer can check, finds every site that misses it
  (21 batch buttons, 21 waiting lists, 522 empty states, about 800 error sentences, plus 15
  confirm windows whose button still reads OK), and plans one sweep per rule in the repo's own
  shape: a codemod with a check in CI where the fix is mechanical, a shared kernel or component
  where the words need a hand. The recommendation is the error sweep first, because one change
  to the shared formatter fixes every call site at once, and the empty-state sweep last, because
  its words are read by a person and no script can write them.
next: The owner picks the order and the first cut. Then the first sweep is cut from fresh main on a morning no code PR is open on its files, run, pushed and armed inside the hour.
size: L, as five sweeps, XS · S · S · M · M, each its own PR train
blocker: the owner's pick, and a quiet main for the two sweeps that touch 300 files
ver: proposed
opinion: run D first, the error sweep, kernel before codemod. Then E, A, B. C never as one PR. The checks that fail CI are D, E and A. B and C are taught, with a warning in the pronoun check's shape.
---

# Consistency sweeps: counted buttons, oldest first, a next press, a named reason (#184)

## The ask

The owner, 2026-10-26, in a holistic look at the user experience: the app has strong
conventions, the newer surfaces follow them, and the older ones predate them. Four were named:
every batch button says its count, every waiting list ages oldest first, every empty state says
what to do next, and every error names its reason. The ask for this session: *"help me come up
with a plan and potentially mockup of what we should do you should present to me before we do
it."* So this to-do plans and presents. It sweeps nothing.

Eight other sessions opened PRs or are writing code today, on the Bridge, dev gates, the phone,
search, desks, ratings and three mock-ups. A sweep that touched their files now would collide.
The plan says when each sweep can run.

## 1. The rules

Each rule is one sentence a script or a reviewer can check, with where it was set and two sites
that already follow it. The fifth is one the entry docs state that older surfaces miss. Two more
candidates were checked and found held, so they get a line, not a sweep.

| | The rule, as a check | Set by | Two sites that follow it |
|---|---|---|---|
| **A** | A button that acts on many rows says how many it will act on and how many it holds, acts on the ready ones, lists the held ones with the reason and a door, and is dead only when nothing is ready. | `CLAUDE.md` → *Do what is ready, never all or nothing* (v2.5533, the Lien desk's run) | `LienDeskRunModal.tsx` over `runRecordWords` in `lib/jobs/lienDeskRun.ts`: *Record 13 · 9 held stay in the pile ▸*. `JobsGcReviewModal.tsx` Print all: *3 printed · 2 held: not checked this week*. |
| **B** | A list of rows waiting on a person sorts oldest first and carries a fresh, amber or red chip at a threshold declared as a named constant in `src/lib/ageState.ts`. | v2.2895, journey-map #40. The Glossary's *Amber / red age (age state)*. | The Dispatch inbox (`DispatchInboxSection.tsx`, `DISPATCH_REQUEST_AGE` 3 / 7). HR pending reports (`HrPendingReportsSection.tsx`, `HR_PENDING_REPORT_AGE` 3 / 7). |
| **C** | An empty list says what fills it and offers the press, or, where empty is the good state, says so and names where to look next. A bare *No bills* or *Nothing here* fails. | No sentence holds it yet. It is practised in v2.5581 (Prospects: the empty lane draws the door as a press), v2.5815 (the Physical inbox's *tray clear*) and the Lien desk's empty piles. This to-do proposes the sentence. | Prospects (`pages/Prospects.tsx` over `lib/prospects/deckWords.ts`): *Nobody on Prospect List yet. New Prospect adds the first company.* Customers (`pages/Customers.tsx`): *No customers yet. Add one.* |
| **D** | The sentence a person reads on a failure comes from `formatErrorMessage` or `formatPostgrestOrUnknownError`, so a network failure gets the offline copy with Retry and a server failure gets a sentence by its code. A `catch` never reads `e instanceof Error ? e.message : '…'`, because a Supabase write error is a plain object and the fallback wins. | v2.2843 (the error's class decides the words), v2.2861 (Retry and the `online` listener). `docs/TROUBLESHOOTING.md`. | The five crew surfaces on `OfflineRetryPanel` (Dispatch Mode Schedule, Clock in, Clock out, the two report windows). `pages/Estimates.tsx` save: `showToast(formatErrorMessage(e, 'Could not save'))`. |
| **E** | A confirm window's button names the act. `confirmLabel` is always passed, so the default *OK* never shows, and `window.alert` and `window.confirm` are never called. | `CLAUDE.md` → *its button says exactly what it will do* (v2.5533). The in-app confirm replaced `window.confirm` on the owner's ask of 2026-08-19. | 186 of 202 confirm calls pass a label. `JobContractModal`, `LienDeskRunModal`, every Delete. |

**Checked and held, no sweep:** *Snooze and Dismiss only on alert items* (the Glossary's Needs
you entry) holds: the only Snooze or Dismiss presses are on the Needs you alert items and the
Robot ruling sheet. Quickfill's Percent complete station has *Dismiss for one week* as an
office-shared row, by design in v2.5764, and is the one grey case. *Customer-facing surfaces stay
light* holds on all nine public routes: every one wraps in `data-theme="light"`. A one-line test
could pin it, and that is a chore, not a sweep.

## 2. The sites

Found by grep and then read, one subagent per rule. Counts are of sites, one per button, list,
sentence or catch block. *script* means a codemod can make the change because what it needs is
in scope in the file. *hand* means the words or the hold need a person.

### A. Batch buttons: 21 sites in 19 files · 10 script · 6 script and hand · 5 hand

About forty batch buttons already follow the rule. Beyond the two in the table above:
*Send all 6 that are ready* (Today's sends), *Send all 7 ready…* (the Contract sweep),
*Sign and approve all 5 and send the run ▸* (Put a GC on notice), *Approve 4 of 6 · 31.5h*
(the Hours approvals queue), *Approve all (212)* with skipped rows named (Banking approvals),
*Apply 9 changes* then *Retry 2 stages* (Align stages), *Send the rest as drafted · 4*,
*Sort 6 charges*, *Mark 7 ordered*, *Schedule 3 people*, *Yes, sweep 12*.

| Site | Surface | The button today | On a hold today | Should say | Fix |
|---|---|---|---|---|---|
| `banking/AccountingApprovalGroupHeader.tsx:111` | Banking → Accounting → Approvals, a group's header | *Reject all* | no holds; the count lives only in the hover | *Dismiss all 14* | script |
| `banking/BankingMercuryUserReviewLedgerModal.tsx:428` | Banking → User review → a cell's ledger | *Unassign all shown* | failures counted, nobody named: *3 of 5 updated* | *Unassign 12 shown*, and name the two that did not | script and hand |
| `banking/BankingMercuryAccountingRulesModal.tsx:236` | Banking → Accounting → Rules | *Apply rules to transactions* | a preflight runs on click and the confirm says the count | *Apply rules · 37 matches* | hand |
| `map/MapGeocodeReviewModal.tsx:343` | Map → address sheet → review every geocode | *Rerun Google for selected* | per-row ok and err chips, loop goes on | *Rerun Google on 7* | script |
| `dashboard/DashboardRecentReportsSection.tsx:278` | Dashboard → Recent reports | *Mark all opened* | no holds possible | *Mark 5 opened* | script |
| `team-feedback/OpenWordsFeed.tsx:55` | Team feedback → Open words | *Mark all read* | no holds possible | *Mark 3 read* | script |
| `pay/DraftPayrollModal.tsx:512` | People → Payroll → Draft payroll | *Generate Remaining* | the toast counts failures, lists none | *Generate 6 reports*, and list the ones that did not | script and hand |
| `settings/SettingsHcpReconcileSection.tsx:386` | Settings → HCP reconcile → invoices | *Apply* | throws on the first bad row, the rest never run | *Apply 12 · 3 invoices, 5 dates, 4 links* | script and hand |
| `settings/SettingsHcpReconcileSection.tsx:419` | Settings → HCP reconcile → payments | *Apply* | the same | *Apply 9 · 7 dates, 2 splits* | script and hand |
| `settings/SettingsDashboardTab.tsx:608` | Settings → Dashboard → pin Billed Awaiting for users | *Pin To Dashboard* | keeps only the last error | *Pin for 4 users* | script |
| `settings/SettingsDashboardTab.tsx:505` | Settings → Dashboard → page pins | *Clear all page pins* | no holds possible | *Clear 6 page pins* | script |
| `SupplyHousesTab.tsx:2805` | Materials → Supply houses → Apply payment | *Apply* | an error is swallowed, the form stays open | *Apply to 4 invoices* | script, and the silent error is its own bug |
| `partnerships/PartnershipJobReviewTab.tsx:584` | Partnerships → Job review → checked sessions | *Move hours* | one update, an error stops all | *Move 5 sessions · 12.0 h* | script |
| `schedule/ScheduleShareModal.tsx:572` | Schedule → Share → Send now | *Send now* | the function skips people with no email and says nothing | *Send to 3 · 1 has no email* | script and hand |
| `bids/BidRfiQueue.tsx:215` | Bids → RFIs → paste CountTooling flags | *Import as drafts* | throws on the first bad row | *Import 6 as drafts* | script and hand |
| `bids/ClearAllCountsModal.tsx:81` | Bids → Counts → Clear all counts | *Delete all count rows* | no holds possible | *Delete 42 count rows* | script |
| `jobs/ScheduleJobModal.tsx:409` | Jobs → Schedule → several assignees | *Add to schedule (3)* | one overlap returns before the insert, nobody is scheduled | *Add 2 to schedule · 1 held: overlaps* | hand, the insert is one linked group by design |
| `materials/SupplyHouseAskSheet.tsx:301` | Materials → Supply houses → the Ask sheet | *Save 4 answers*, dead while any balance is red | one red row holds every answer | *Save 3 answers · 1 held: fix the balance* | hand |
| `jobs/PaymentChaseModal.tsx:211` and `DashboardArCallCard.tsx:116` | Billed → Payment chase → They promised | the outcome chip | writes job by job and throws at the first failure | *Promised on 3 bills*, and name the one that did not take | hand |
| `bids/AdoptBidModal.tsx:213` | Bids → Adopt bids as versions | *Adopt 3 bids* | stops at the first error, the rest never tried | keep the label, try every row, list the ones that did not adopt | hand |
| `PeopleHoursDayAuditModal.tsx:632` | People → Hours → a day's audit | *Approve all (4)* | typed rows set aside, only the hover says so | *Approve 4 punches · 1 typed waits* | script |

Left out on purpose: *Export all backup* is one file, Certify is all-checked by definition,
*Open all* and *Show all N* are view toggles, a share to N contacts is one email.

### B. Waiting lists: 21 sites in 34 files · 10 script · 11 hand

Already following, beyond the two above: the one-off tasks (`ONE_OFF_TASK_AGE` 7 / 31), the
job-account move asks (`SUPPLY_MOVE_ASK_AGE` 3 / 7), the Physical inbox papers
(`PHYSICAL_INBOX_PAPER_AGE` 2 / 7), Workflow expected dates (`dueState`), a tech's own requests,
and the lists whose right order is a deadline, not an age: the Lien desk's piles, the RFQ desk,
GC mode's change requests, back charges and RFIs. Proposed thresholds are guesses beside the
precedents. Each is one constant to change.

| Site | Surface | Today | Should | Fix |
|---|---|---|---|---|
| `hooks/useEstimatorInbox.ts:67` and `EstimatorInboxSection.tsx:413` | Checklist and Dashboard → Estimator inbox, open requests | customer-waiting first, then open rows newest first, gray *(12 d ago)* | open rows oldest first, chip beside the date, `ESTIMATOR_REQUEST_AGE` 3 / 7 | script |
| `lib/helpFeedbackHelpers.ts:40` and `HelpFeedbackInboxSection.tsx:88` | Help feedback inbox, open feedback | newest first, a datetime | oldest first, chip, `HELP_FEEDBACK_AGE` 7 / 14 | script |
| `bids/TwinOperatorQuestionsCard.tsx:180` | Bids → Robot console → Operator questions | open first, then newest first, gray relative time | open rows oldest first, chip, `TWIN_QUESTION_AGE` 1 / 3 | script |
| `bids/BidsAuditsTab.tsx:348` | Bids → Audits → Standing rulings | `ascending: false`, no chip | ascending, chip, the same constant | script |
| `lib/checklistReviewQueue.ts:142` and `ChecklistReviewInboxSection.tsx:333` | Checklist → Review inbox, completions waiting on the reviewer | newest done first, gray *done Oct 24* | oldest first, chip on the done stamp, `CHECKLIST_REVIEW_AGE` 2 / 5 | script |
| `dashboard/DashboardFieldCollectPaymentQueue.tsx:443` | Dashboard → Field: Waiting for Approval | has the chip, loads `certified_at` desc and renders unsorted | `ascending: true`, one token | script |
| `people/PeopleHoursApprovalsQueueModal.tsx:520` and `lib/people/approvalsQueue.ts:283` | People → Hours → Approvals queue | oldest first, gray *(9d)* only past seven days | chip from the days it already has, `HOURS_APPROVAL_AGE` 3 / 7, the v2.2671 precedent | script |
| `hooks/useDashboardMyTeamSectionState.ts:542` | Dashboard → My Team → pending sessions | `work_date` desc, no chip, the banner is a count | oldest work date first, chip by `ymdAgeDays` | hand, four queries and a strip that groups by person |
| `quickfill/QuickfillPeopleHoursNewSection.tsx:176` | Quickfill → People hours new → pending by day | newest work date first | flip, chip on the date, `HOURS_APPROVAL_AGE` | script |
| `quickfill/QuickfillJobsCleanupSection.tsx:63` and `lib/jobs/subLaborUnlinked.ts:74` | Quickfill → Jobs cleanup → sheets with no job | newest labor date first, then biggest dollars | oldest first, chip, `UNLINKED_SHEET_AGE` 7 / 14 | hand, the dollar order was a choice |
| `hooks/useQuickfillCantReachProspects.ts:50` and `CantReachSection.tsx:150` | Quickfill → Can't reach | most recently tried first | longest since the last try first, chip, `CANT_REACH_RETRY_AGE` 7 / 14 | script |
| `pages/Prospects.tsx:953` and `lib/prospects/callingOrder.ts:46` | Prospects → Follow Up queue | coldest first, flat amber words at any age | chip from the days it computes, `PROSPECT_CALL_AGE` 7 / 30 | hand, three modes reorder on purpose |
| `quickfill/QuickfillUndatedBillsSection.tsx:41` and the RPC in `20260826050000_undated_bill_worklist.sql` | Quickfill → Undated bills | the RPC orders newest first, no age | oldest first, chip on `createdYmd`, `UNDATED_BILL_AGE` 3 / 7 | hand, the order is in a migration |
| `quickfill/UnpricedFixturesSection.tsx:18` and the RPC in `20260927233000_controller_functions_the_rest.sql` | Quickfill → Unpriced fixtures | the RPC orders newest first | oldest first, chip, `UNPRICED_PART_AGE` 3 / 7 | hand, a migration |
| `bids/BidsRobotQueueTab.tsx:315` | Bids → Robot queue → Price matrices | oldest first, gray age words | chip beside the words, a threshold in hours needs a decision | hand |
| `dashboard/DashboardSubMoneySection.tsx:65` | Dashboard → Sub money | newest sheet first | the right order is `payable_after`, a due date: `dueState` | hand |
| `jobs/JobsContractSweepModal.tsx:257` | Jobs → Contract sweep | status rank, then job created, no chip | the gap has no stamp of its own | hand |
| `lib/followUp/queue.ts:142`, `FollowUpSections.tsx:378`, `lib/quickfill/textsLedger.ts:46` | Messages → Needs a reply, Quickfill → Texts | longest waiting first, flat amber *Our move · 2 h ago* | `ageStateForDays` on the wait, `CUSTOMER_REPLY_AGE` 1 / 2 | hand, these are the prototype's golden words |
| `jobs/legal/LegalDeskPacketTab.tsx:278` and `lib/legal/legalMatters.ts:353` | Legal desk → Packet, the firm's entries waiting on the office | newest first on the card, a pill with no age | chip on the pill and the Needs you line, `LEGAL_FIRM_ENTRY_AGE` 2 / 5 | hand |
| `banking/BankingMercuryAccountingTab.tsx:829` and `lib/accountingApprovalGroups.ts:80` | Banking → Accounting → pending suggestions | loaded newest first, grouped by label | groups by their oldest suggestion, chip, `LABEL_APPROVAL_AGE` 3 / 7 | hand, grouping by label is the design |
| `lib/contracts/approval.ts:351` and `contracts/ClauseNeedRows.tsx:42` | Needs you → Contracts, clause changes awaiting approval | oldest first, a badge and a stamp, no state | `describeAge` beside the stamp, `CLAUSE_APPROVAL_AGE` 3 / 7 | script |

Ruled out as right newest-first: the Messages feeds, the Checklist history ledger, the team
feedback feeds, partner call logs, field-report history, robot run history, prospect comments,
the plan-question thread, and every register or timeline.

### C. Empty states: 522 sites in 322 files · 124 script · 398 hand

942 empty-state sentences in 524 files. 264 already follow, 156 are cell and chip fallbacks a
sentence serves (*No house*, *No reading yet*, a combobox's *No matches*). The 522 misses by
kind: **data** 228 (what fills the list is another page), **filter** 139 (a search or a range
hides the rows), **make** 80 (the viewer makes the thing), **waiting** 75 (empty is the good
state). 208 of them are on pages and top-level tabs. There is no shared `EmptyState` today.
What exists: an `emptyMessage: string` prop on four list components, word kernels for three
sites (`lib/prospects/deckWords.ts` has the shape to lift: `main`, `door`, `doorLabel`, `tail`),
a per-section string table in `GcBoard.tsx`.

The ones a person meets most, pages and top-level tabs first:

| Site | Surface | Today | Kind | Should say | Fix |
|---|---|---|---|---|---|
| `pages/Estimates.tsx:802` | Estimates list | *No estimates yet.* | make | *No estimates yet. New estimate ▸ starts the first.* | script |
| `pages/Estimates.tsx:974` | Estimates, after a search | *No estimates match your search.* | filter | *No estimates match 'Ridgeway'. Clear the search ▸* | script |
| `pages/Estimates.tsx:1056` | Estimates → Follow-up: Unsent, Sent, Accepted | *No estimates* ×3 | waiting | *Nothing unsent. Every draft went out.* and so on per lane | hand |
| `bids/BidPickerStandardList.tsx:163`, fed by nine Bids tabs | Bids → RFI, Change order, Lien release, Cover letter, Counts, Labor, Pricing, Takeoff, Submittals | *No bids yet.* · *No bids you are the account manager or estimator for.* · *No bids match your search.* | make, data, filter | one fix at the shared list: *No bids yet. New Bid ▸* · *None of the bids name you. Show every bid ▸* · *No bids match 'Ridgeway'. Clear the search ▸* | script |
| `pages/Checklist.tsx:3661` | Checklist → Manage | *No checklist items yet.* | make | *No checklist items yet. Add item ▸ adds the first.* | script |
| `pages/Checklist.tsx:794`, `:2670` | Checklist → Today, Outstanding | *No checklist items due today.* · *No outstanding checklist items.* | waiting | *Nothing due today. Upcoming ▸ shows what comes next.* · *Nothing outstanding. Everyone is caught up.* | hand |
| `pages/Customers.tsx:913` | Customers, after a search | *No customers match your search.* | filter | *No customers match 'Ridgeway'. Clear the search ▸ or Add customer ▸* | script |
| `pages/Documents.tsx:378`, `:904`, `:1336`, `:1610` | Documents → the four ledgers | *No estimates in this ledger.* ×4 nouns | data | *No estimate has been sent yet. Estimates ▸* and the matching page per ledger | hand |
| `pages/Documents.tsx:382`, `:908`, `:1340`, `:1614` | the same, after a search | *No estimates match your search.* ×4 | filter | *… match 'Ridgeway'. Clear the search ▸* | script |
| `pages/Prospects.tsx:4172`, `:3102` | Prospects → Prospect List, Subs | *No prospects yet.* · *No subs yet.* | make | reuse `emptyLaneWords`: *Nobody on the list yet. New Prospect ▸* · *No subs yet. Add a sub ▸* | script |
| `pages/Partnerships.tsx:548` | Partnerships | *No partnerships yet.* with *+ New* above, unnamed | make | *No partnerships yet. + New ▸ adds the first.* | script |
| `pages/Calendar.tsx:1906`, `:861` | Calendar → Upcoming, planned work | *No upcoming items.* · *No planned work.* | data | *Nothing is scheduled ahead. Schedule hub ▸ plans the next block.* | hand |
| `pages/CustomerDetail.tsx:720` | Customer → activity feed | *Nothing here yet.* | make or filter | *Nothing in the feed yet. Post the first note ▸* · *Nothing for this filter. All ▸* | hand |
| `pages/Banking.tsx:1865`, `:2159` via `BankingMercuryTable` | Banking → Ledger, Sorting, after a search | *No transactions match your search.* | filter | *… match 'Hartline'. Clear the search ▸*, the prop grows from a string to words and a press | hand |
| `jobs/JobsStagesCardList.tsx:875` | Jobs → Stages, every group | *No jobs in this group* · phone: *Nothing here needs you* | waiting | desktop matches the phone: *Nothing in Rough-in needs you.* | hand |
| `jobs/JobsInspectionsTab.tsx:509`, `:681`, `:751` | Jobs → Inspections → Upcoming, Edit types, Edit portals | *No upcoming inspections in the next 14 days.* · *No inspection types yet.* · *No portals yet.* | waiting, make | *Nothing booked in 14 days. Add inspection ▸* · *No inspection types yet. Add type ▸* · *No portals yet. Add portal ▸* | hand, script, script |
| `jobs/JobsReportsTab.tsx:416` | Jobs → Reports → Templates | *No templates yet.* | make | *No templates yet. Add template ▸* | script |
| `jobs/JobsCrewPnlTab.tsx:444` | Jobs → Crew P&L | *No labor or billing activity in this range.* | filter | *Nothing clocked or billed between Oct 1 and Oct 26. Widen the range ▸* | hand |
| `bids/BidSubmissionFollowupTab.tsx:1641` and four more | Bids → Submission follow-up, five groups | *No bids in this group* ×5 | waiting | per group: *Nothing pending with a GC.* · *No wins in this window yet.* | hand |
| `bids/BidsWorkingBoard.tsx:891` | Bids → Working board | *No bids assign you as Estimator or Account Man for this service type.* | data | *Nothing is assigned to you on Plumbing. Bid Board ▸ lists every bid.* | hand |
| `bids/BidsRobotQueueTab.tsx:352` | Bids → Robot queue → Ready | *Nothing ready right now.* | waiting | *Nothing ready. A bid is ready once its plans are on it. Add the plans ▸* | hand |
| `DispatchInboxSection.tsx:216`, `EstimatorInboxSection.tsx:213` | Dashboard → Dispatch inbox, Estimator inbox | *No dispatch requests.* · *No estimator requests.* | waiting | *Nothing waiting on dispatch.* · *Nothing waiting on an estimator.* and where a request comes from | hand |
| `dashboard/DashboardBillingPipelineSection.tsx:249` | Dashboard → Ready to bill | *No jobs or invoices ready to bill yet* | waiting | *Nothing is ready to bill. Stages ▸ shows what is still in progress.* | hand |
| `dashboard/DashboardMyScheduleSection.tsx:374`, `DashboardMyTimeSection.tsx:749` | Dashboard → My schedule, My time | *No blocks scheduled.* · *No time logged this week.* | data | *Nothing scheduled for you today. Schedule ▸* · *Nothing clocked this week. Clock in ▸* | hand |
| `DashboardArCustomersView.tsx:397` | Dashboard → AR by customer | *Nothing here.* · *Nothing matches 'q'.* | waiting, filter | *Nothing is waiting on a customer. Every bill is paid.* · *… Clear the search ▸* | hand |
| `dispatchMode/DispatchModeHome.tsx:159`, `DispatchModeSchedule.tsx:596` | Dispatch mode → Home, Schedule | *No open jobs.* · *Nothing scheduled.* | data | *No open jobs. New Job ▸* · *Nothing scheduled today. Schedule hub ▸* | hand |
| `people/PeopleUsersTab.tsx:736`, `PeopleContractsTab.tsx:2100`, `PeopleEmploymentTab.tsx:659`, `PeoplePayLedgerView.tsx:528`, `PeoplePayStubsTab.tsx:699`, `PayRunPaymentsView.tsx:269` | People → six tabs, after a search | *No matches.* · *No one matches.* · *No payment matches.* | filter | *Nobody matches 'Marisol'. Clear the search ▸* | script |
| `people/PeopleSubsTab.tsx:351`, `PeopleVehiclesWheelsSection.tsx:273`, `PeopleLicensesTab.tsx:337` | People → Subs, Vehicles, Licenses | *No subcontractors on the roster yet.* · *No vehicles yet.* · *No licenses.* | make | *No subs yet. Hire ▸ one on Users.* · *No vehicles yet. Add vehicle ▸* · *No licenses on file. + Add ▸* | hand |
| `SupplyHousesTab.tsx:1253`, `:1581`, `:1732` | Materials → Supply houses → aging, invoices, POs | *No unpaid invoices.* · *No invoices* · *No purchase orders* | waiting, make, data | *Nothing unpaid. Every supply-house invoice is settled.* · *No invoices on Hartline yet. Add invoice ▸* · *No POs on Hartline. PO builder ▸* | hand |
| `materials/MaterialsPurchaseOrdersTab.tsx:1031`, `MaterialsAssemblyBookTab.tsx:261`, `MaterialsPartsBookTab.tsx:240` | Materials → POs, Assembly book, Parts book, filtered | *No purchase orders match your filters* and two more | filter | *No purchase orders match. Clear filters ▸* | hand |
| `settings/SettingsCatalogsTab.tsx:381`, `SettingsPeopleTab.tsx:299`, `SettingsClausesTab.tsx:210` | Settings → Service types, People, Clauses | *No service types created yet.* · *No assistant or estimator accounts in the system.* · *None yet.* | make | *No service types yet. Add service type ▸* · *… + Hire ▸* · *None yet. New clause ▸* | script, script, hand |
| `banking/BankingMercuryAccountingTab.tsx:2305`, `:2659`, `BankingMercuryDragSortTab.tsx:1031` | Banking → Accounting, Sort | *No pending suggestions.* · *No transactions match the current Banking filters.* · *No Accounting labels.* | waiting, filter, make | *Nothing waiting for approval.* · *Nothing matches the Banking filters. Reset filters ▸* · *No labels yet. New label ▸* | hand |
| `gc/GcBoard.tsx:54` | GC Projects board, every section | *None right now.* · *None yet.* | waiting, make | per section in its `SECTIONS` table: *No project is at this step.* | hand, one place |
| `quickfill/QuickfillScheduleSection.tsx:1565`, `:1571` | Quickfill → Schedule | *No users in the Schedule Dispatch roster.* · *No people match this search.* | data, filter | *Nobody is on the dispatch roster. People → Users ▸ links a login.* · *Nobody matches 'Todd'. Clear the search ▸* | hand, script |

The rest: 314 sentences in windows and sub-sections, by kind data 153, filter 76, waiting 44,
make 41. The 124 script sites are 91 *clear the search* presses, where a `set…Search` setter is
in the file, and 33 make presses, where an `open…Modal` or `setAdding` is in the file. Every
waiting and data site is hand: it needs the words for the good state, or a route to the page
that fills it. The subagent's full lists are in the plan's scratch, not here: a sweep PR carries
its own list.

### D. Errors: about 800 sites · 290 script now · the rest once the kernel reads a plain object

One fact shapes every count. A Supabase result's `.error` is a plain object, parsed from the
body, and the app throws it with `if (error) throw error` in 361 places. `formatErrorMessage`
has no plain-object branch: it reads `instanceof DatabaseError`, then a fetch-layer `TypeError`,
then `instanceof Error`, then a string, then the fallback. So on a plain object it falls to the
fallback exactly as the ternary does. `formatPostgrestOrUnknownError` does read a plain object,
with its `Code:` and `Details:` lines meant for a `pre-wrap` box. The code already says so, in
`lib/offlineRecoveryState.ts`.

| Pattern | Sites | Files | Script | Hand | Notes |
|---|---|---|---|---|---|
| P1 · a fixed sentence in a `catch`, no reason | 121 | 84 | 6 now, 40 once `catch {` binds `e` | 81 | 37 database or edge sentences (34 are `catch {` with one toast). 25 hand-rolled *check your connection* on the public portals and one wheel. 34 clipboard copies, 11 PDF builds, 14 partial-success warnings are a design choice and stay. |
| P2 · `e instanceof Error ? e.message : '…'` feeding what a person sees | 634 | 304 | 284 | 60 | 214 catch a `withSupabaseRetry` or `checkSupabaseError` throw (a `DatabaseError`, so the formatter names the reason). 70 catch `throw new Error`. 60 in 30 files catch a plain `throw error`. 278 call a helper whose throw was not read. 113 use `String(e)` as the fallback, which prints `[object Object]` on a plain object. |
| P3 · the network decided by text | 1 strict, 3 lenient | 1 | 1 | 2 | `pages/SubmittalRoom.tsx:141` tests `/fetch/i` on the message. `lib/signInMagicLink.ts` reads GoTrue's words, which carry no class, and is fair. |
| P4 · a load failure on a crew or phone surface with no Retry | 26 | 25 | 0 | 26 | 14 signed-in crew surfaces, 12 public phone pages. The error state is a string and `OfflineRetryPanel` needs `{ kind, message }`, so the state and the load handler both change. |
| raw `.message` straight to a toast | about 340 | about 100 | all | | names the server's reason but skips the class sentence: an RLS refusal reads *new row violates row-level security policy*, a dead signal reads *TypeError: Failed to fetch*. |

The ones a person meets most:

| Site | Surface | Today | Pattern | Should say | Fix |
|---|---|---|---|---|---|
| `pages/Checklist.tsx:2091`, `:2173`, `:2198`, `:2248` | Checklist → Delete, Mark complete, Undo, Forward | *Failed to delete* and three more, the fallback every time because the try does `if (err) throw err` | P2, plain throw | *You don't have permission to delete checklist items.* or the server's reason | script once the kernel reads a plain object |
| `pages/Checklist.tsx:427` | Checklist, the one red line under the list | the last load's raw message, no Retry | P4 | the offline copy with Retry on a load | hand, loads and actions share one state |
| `pages/JobTally.tsx:384`, `:1415` | Job Tally → transactions, your note | *Could not load transactions.* no Retry · *Could not save note.* | P2 and P4 | *Couldn't load transactions: …* with Retry · *Couldn't save the note: …* | script, Retry by hand |
| `pages/Training.tsx:72`, `:140` | Training | *Could not read your training* with a Dashboard link · *Could not record the lesson* | P2 and P4 | the class sentence and Retry | script, Retry by hand |
| `pages/Dashboard.tsx:965` | Dashboard → open a job | *Could not load job* | P2 | *Couldn't load the job: …* | script |
| `ClockInOutButton.tsx:1336` | Clock in → switch focus job | *Failed to switch focus* | P2, plain throw | *Couldn't switch the focus job: …* | script once the kernel reads a plain object |
| `dashboard/DashboardSupervisorSection.tsx:59`, `team-feedback/RateMyCrewDeck.tsx:78` | Dashboard → Your crew, Rate my crew | *Could not load your crew — Failed to get_supervised_days_payload: …* no Retry | P2 and P4 | *Couldn't load your crew: …* with Retry | script, Retry by hand |
| `team-feedback/CrewReviewDeck.tsx:129`, `:188` | the crew review deck → Skip, Snooze, rate, send | *Could not save skip*, a `catch {}` with nothing bound | P1, P2 | *Couldn't save the skip: …* | script once `e` is bound |
| `DashboardMyVehicleCard.tsx:67` | Dashboard → My vehicle | nothing: a failed read draws an empty card | P4, silent | *Couldn't load your vehicle: …* with Retry | hand |
| `dispatchMode/DispatchModeHome.tsx:157`, `DispatchModeCustomers.tsx:204` | Phone dock → Home, Customers | the right words, no Retry | P4 | the same with Retry | hand |
| `jobMode/JobModeMyRequests.tsx:90` | Job Mode → My requests | *Couldn't load your requests: …* raw, no Retry | P4 | the class sentence with Retry | hand |
| `tally/TallyClockWindowAllocateModal.tsx:213`, `TallySortPurchaseModal.tsx:159` | Job Tally → allocate, sort | *Could not load clock sessions.* · *Save failed.* | P2 and P4 | the reason, and Retry on the load | script, Retry by hand |
| `checklist/ChecklistCostModal.tsx:91`, `ChecklistItemEditModal.tsx:306`, `ChecklistTechTreeTab.tsx:191` and 12 more there | Checklist → cost window, edit item, Tech tree | *Load failed* · *Save failed* · *Failed to save* · *Failed to load roadmaps* | P2 | the class sentences | script |
| `clock-sessions/AssignSessionJobPopover.tsx:325` | My time → assign a session to a job | *Failed to assign* | P2 | *Couldn't assign the session: …* | script |
| `materials/MarkJobAccountOpenedModal.tsx:96` | Supply houses → job account opened | *Could not save the job account.* | P2, plain throw | the reason | script once the kernel reads a plain object |
| `pages/SubPortal.tsx:180`, `:750`, `:787`, `:847` | Sub portal (phone) → statement, progress, date, sign | *We could not open your statement. Please check your connection and try again.* for any failure · *Something went wrong. Please check your connection.* | P1 and P4 | the offline copy only for a network failure, with Retry; for a server refusal *We couldn't record that. The office can see why.* | hand, the portal's voice is a design choice |
| `pages/CustomerPortal.tsx:161`, `:1176` and six portal cards in `components/portal/` | Customer and GC portal (phone) → load, request a quote, the asks | the same two sentences | P1 and P4 | the same, through one shared fetch helper | hand, one helper fixes all |
| `pages/BidRoom.tsx:153`, `JobContractSign.tsx:135`, `EstimateAccept.tsx:170`, `ContractAccept.tsx:194`, `PayLink.tsx:65`, `GcWordAsk.tsx:75` | the six customer links | *Could not load the proposal. Check your connection.* for any error, no Reload | P1 and P4 | class-decided, with Reload | hand |
| `pages/SubmittalRoom.tsx:141`, `:236` | Submittal room | `/fetch/i` on the message picks the sentence · *Could not reach the office…* in a `catch {}` | P3, P1 | `errorKindOf(err) === 'network'` | script, Reload by hand |
| `bids/BidsSubmittalsTab.tsx:1782` and 27 more in the file | Bids → Submittals | *Could not save.* | P2, 20 plain throws | *Couldn't save: …* | script once the kernel reads a plain object |
| `jobs/LienFilingTabs.tsx:355`, `:464`, `:503`, `:553` | Lien desk → filings | *Could not save the record.* in a `catch {}` around `withSupabaseRetry` | P1 | *Couldn't record the lien filing: …* | script once `e` is bound |
| `jobs/JobContractModal.tsx:736`, `:701` | Job → Contract | *Could not save that.*, `flushDraft` swallows the reason | P1 | the reason from `flushDraft` | hand |
| `jobs/SendRecordInvoiceModal.tsx:1697` | Bill customer → Send | *Failed to save* in the last branch | P2 | `formatErrorMessage(e, 'Failed to save')` | script |
| `bids/RobotNeedsSheet.tsx:84` | Bids → the robot's needs → Find the folder | the last `window.alert` in the app, with the ternary inside | P2 and E | a toast with the reason | script |

The heaviest files beyond the table: `BankingMercuryAccountingTab.tsx` 20 ternaries,
`pages/Banking.tsx` 19, `JobsGcReviewModal.tsx` 10, `useSettingsBackupExports.ts` 10,
`BankPaymentsModal.tsx` 11, `DigitalTwinsPanel.tsx` 8, `PeopleContractsTab.tsx` 7,
`pages/Prospects.tsx` 7. The subagent's scan is a JSON per pattern in the session's scratch and
is regenerated by the sweep's own script.

### E. Confirm buttons that read OK: 15 sites in 11 files · all hand, one line each

202 confirm calls, 186 pass `confirmLabel`. The 15 that keep the default *OK*:
`settings/LienSignCodeCard.tsx:74` (*Remove your signing code?* · OK),
`TimeOffSettings.tsx:90` (*Mark yourself as not coming in today?* · OK),
`settings/EmailReaderSettingsCard.tsx:45`, `DevMcpKeysCard.tsx:99`,
`ReplyPushSettingsCard.tsx:71`, `EmailCountSettingsCard.tsx:181` and `:186`,
`TextsSwitchSettingsCard.tsx:45`, `customers/CustomerPortalGlobeButton.tsx:344`, `:387`, `:401`,
`:415`, `people/SubPortalGlobeButton.tsx:293`, `:314`, `:333`. Each takes the verb its message
already holds: *Remove the code*, *Mark me out today*, *Turn the reader off*. One `window.alert`
remains, `bids/RobotNeedsSheet.tsx:84`.

## 3. The plan

One sweep per rule, each in the repo's shape: a script in `scripts/codemods/` with `--check`
wired into `deploy.yml` as a `check:*` script where the fix is mechanical, a shared kernel or
component where the words need a hand. The order is the recommendation, argued below.

### Sweep D first · errors name their reason · M as three PRs

- **PR 1, the kernel (XS).** `formatErrorMessage` gets the plain-object branch
  `formatPostgrestOrUnknownError` already has: a non-Error object with a `message`, a `code` or
  a `status` is classified by `classifyResultError` and rendered by `describeClassifiedError`,
  the lead sentence only, no `Code:` or `Details:` lines. A test per shape: a PGRST116 object, a
  42501 object, a `{ code: '', status: 0 }` network object, a bare `{ message }`. This one change
  makes every one of the 916 existing `formatErrorMessage` call sites honest on a plain object,
  and makes the codemod below a full fix instead of a half one. Nothing else moves.
- **PR 2, the codemod (M, one PR, 304 files).** `scripts/codemods/error-reason-sweep.mjs`, parsed
  with the TypeScript compiler like `dialog-role-sweep.mjs`: rewrites
  `x instanceof Error ? x.message : <fallback>` to `formatErrorMessage(x, <fallback>)` and adds
  the import; `String(e)` fallbacks become the file's nearest fixed sentence, printed for a hand
  to check; `catch {` whose only statement is a toast or a setter with a string literal becomes
  `catch (e) {` with the literal wrapped; `/fetch/i.test(message)` becomes
  `errorKindOf(e) === 'network'`; the one `window.alert` becomes a toast. The script **skips the
  public pages and the portal cards** (`pages/{CustomerPortal,SubPortal,PayLink,BidRoom,
  JobContractSign,EstimateAccept,ContractAccept,GcWordAsk,SubmittalRoom}.tsx`,
  `components/portal/*`): a customer never reads a server's words. `--check` refuses the ternary,
  the unbound catch with a literal, and the text test, anywhere under `src/`, and prints the
  command that fixes it. `deploy.yml` gains `check:error-words`. The sentence in `CLAUDE.md` →
  Working conventions: *an error names its reason: the words come from `formatErrorMessage`,
  never from `instanceof Error`*.
- **By hand, by surface, after (S each).** The 26 load failures with no Retry on crew and phone
  surfaces, wired like v2.2861: the state becomes `{ kind, message }` from
  `recoveryFailureFromError` and `OfflineRetryPanel` draws it, the phone dock's Home and
  Customers first. The public pages' voice: one shared fetch helper in `lib/portal/` that
  returns the class, so a network failure reads the offline copy with Retry and a server
  refusal reads *We couldn't record that. The office can see why.* with *Call the office*.
- **Collides with:** PR #6158 (`LienReleaseModal.tsx`, six P1 sites), PR #6182
  (`BankingAccountNicknamesModal.tsx`), and any code PR open on a file with a ternary, which
  today is most of them. The codemod re-runs on rebase, so the cost of a collision is one
  re-run, not a hand merge. Cut it the first morning the queue is empty, run, push and arm it
  inside the hour, and let it merge before the next feature PR.
- **What the check refuses afterward:** a new `instanceof Error ?` ternary, a `catch {` with a
  literal, a `/fetch/` text test. A PR that adds one fails with the fixing command.

### Sweep E second · a confirm's button names the act · XS, one PR

- `confirmLabel` becomes **required** in `ConfirmDialogOptions` and `PromptDialogOptions`, so the
  typecheck is the check and no script is needed. The 15 labels are written by hand, each from
  its own message. The ESLint rule `no-restricted-globals` refuses `alert`, `confirm` and
  `prompt`, and the one alert becomes a toast in sweep D or here, whichever lands first.
- **Collides with:** the dev-gates session, which is writing Settings cards today. Eight of the
  15 are in `components/settings/`. Cut it after that session's PR lands.
- **What the check refuses afterward:** a confirm with no label fails typecheck. A native dialog
  fails lint.

### Sweep A third · a batch button says its count · S as two PRs

- **PR 1, the kernel and the lint.** `lib/batchWords.ts`: `batchWords({ verb, noun, ready, held,
  heldWhy? })` returns the button and the foot in the Lien run's shape, *Send 4 · 2 held*, *Send
  4*, *Nothing is ready to send*, with a test. `scripts/codemods/batch-label-sweep.mjs --check`
  refuses a static button label that says *all*, *selected*, *shown* or *remaining* with no
  number in it, with an allow-list for the view toggles (*Select all*, *Show all N*, *Open all*,
  *Close all*). `deploy.yml` gains `check:batch-words`.
- **PR 1 also carries the 10 script sites:** the array is in scope, so the label takes the count
  mechanically: *Dismiss all 14*, *Rerun Google on 7*, *Mark 5 opened*, *Mark 3 read*, *Pin for
  4 users*, *Clear 6 page pins*, *Apply to 4 invoices*, *Move 5 sessions · 12.0 h*, *Delete 42
  count rows*, *Approve 4 punches · 1 typed waits*.
- **By hand, one PR per surface (S each):** the 6 script-and-hand sites, whose held list needs
  the kernel's foot and a stop that continues (the Draft payroll's *Generate 6 reports*, the HCP
  reconcile's two Applies, Schedule → Share's *Send to 3 · 1 has no email*, the RFI import, the
  user-review ledger), then the 5 hand sites: the Ask sheet's held answer, the Schedule window's
  overlap, the Payment chase's promise, Adopt bids, the Rules window's count.
- **Collides with:** nothing open today on its 19 files. The bill-capture to-do plans a Bills
  inbox on Materials, which would redraw `SupplyHousesTab.tsx` later, so land the Supply houses
  row before that build starts.
- **What the check refuses afterward:** a new *Approve all* or *Send selected* with no number.

### Sweep B fourth · a waiting list reads oldest first with a chip · S as one PR, then by hand

- **PR 1, the 10 script sites.** Each is one sort flip and one `describeAge` call beside a date
  the row already draws, with its constant added to `ageState.ts`: the Estimator inbox, the Help
  feedback inbox, the Operator questions card, Standing rulings, the Checklist review inbox, the
  Collect-payment queue's one token, the Hours approvals queue's chip, People hours new, Can't
  reach, the clause approvals. Each kernel gets a test in the dispatch pattern
  (`sortDispatchInboxRows`), and the Glossary's *Amber / red age* entry lists the new surfaces.
- **By hand (S each):** the two RPC orders, each a migration with `lock_timeout`; My Team's four
  queries; the Jobs cleanup order; Sub money on `dueState`; the Legal desk's firm entries; the
  Banking groups; and the three the owner decides: Prospects' modes, the price-matrix queue's
  hours, and whether the Messages family keeps its flat amber *Our move · 2 h ago*.
- **No failing check.** The rule cannot be a grep: a descending `created_at` is right on a feed
  and wrong on an inbox, and only the surface knows which. The check is each kernel's test and
  the Glossary line. A warning in the pronoun check's shape, `check:waiting-order`, names a hook
  that orders `created_at` descending in a file whose name says Inbox, Pending, Approval, Queue
  or Requests and does not import from `ageState.ts`. It never fails.
- **Collides with:** the needs-me-rail and quickfill-read-state to-dos propose redraws of the
  Quickfill stations and the Dashboard's morning. Four of the ten sites are stations. Land the
  flips before those builds, or inside them.

### Sweep C last · an empty state names the next press · M for the piece, never one PR for the words

- **PR 1, the component (S).** `components/EmptyState.tsx`: `main`, then `next` as
  `{ label, onPress }` or `{ label, to }`, or `nothing` for a waiting list's good-state sentence,
  then an optional `tail`, drawn from `deckWords`' shape. The `emptyMessage: string` prop on
  `BidPickerStandardList`, `BankingMercuryTable`, `ClockSessionsTable` and `DashboardMyTeamSection`
  grows to take it, which fixes the nine Bids pickers at once. Prospects and the Lien desk's
  piles move onto it so there is one shape. A Glossary entry *Empty state* and the sentence in
  `CLAUDE.md`.
- **PR 2, the one mechanical press (S, 91 sites).** *Clear the search ▸* is the one empty state
  whose words are the same everywhere and whose setter is in the file. The codemod finds the
  `No … match your search` text node, the `set…Search` or `set…Query` setter beside it, and
  wraps both in `EmptyState`, quoting the search term. Rebase by re-run.
- **By hand, by surface area (S each, over weeks):** the 33 make presses, each naming its own
  control, then the waiting and data sentences, page by page, in the order people meet them:
  the Dashboard cards, the Checklist tabs, Estimates, Documents, the Jobs tabs, the Bids tabs,
  People, Materials, Settings. Each PR carries its own list.
- **The check is diff-only.** `check:empty-words` reads the lines a PR adds, like
  `check:pronouns`, and fails on a new JSX text node that opens with *No*, *Nothing* or *None*
  and ends with no press, outside an `EmptyState`. The 398 legacy sentences are counted in the
  log, never a block. A strict check over all of `src/` would fail every PR until the last
  sentence is rewritten, and the sentences are read by people, so no script writes them.
- **Collides with:** everything. Three of the top rows are on the Bridge's files (#6182) and the
  Messages lanes (#6177). That is why the words go by surface, each PR cut when its surface is
  quiet, and only the component and the one press go as sweeps.

### The order, in one table

| | Sweep | Mechanical | By hand | Files | Check in CI | Cut when |
|---|---|---|---|---|---|---|
| 1 | **D** errors | kernel branch; 634 ternaries, 40 unbound catches, the text test, the alert | 26 Retry panels; the public voice | 304 | `check:error-words` fails | the first empty queue |
| 2 | **E** confirm labels | the type; the lint | 15 labels | 11 | typecheck and lint fail | after dev-gates lands |
| 3 | **A** batch counts | the kernel; 10 labels; the lint | 11 held lists | 19 | `check:batch-words` fails | now |
| 4 | **B** oldest first | 10 flips and chips | 11, two of them migrations | 34 | kernel tests; a warning | before the Quickfill redraws |
| 5 | **C** empty states | the component; 91 clear-the-search presses | 33 make, 303 waiting and data | 322 | `check:empty-words` on added lines | the component now; the words by surface |

### Is this the best we can do?

**A sweep that rewrites words a person reads is not mechanical.** True of C's 398 and A's 11
and B's 11. The scripts find them and frame them, a hand writes them. So the plan changed: C's
sweep is the component and the one press whose words are the same everywhere, nothing else; A's
sweep carries only the labels whose count is already in scope; B's carries only flips beside a
date already drawn. Every other site is a surface PR with its own list, cut when that surface is
quiet. D is the exception that proves it: its words come from the server's code and the error's
class, so no person writes them, and that is why it goes first.

**A check that is too strict blocks every PR.** C's check over all of `src/` would fail 398
times on day one, and every PR on those files until each is rewritten. So C's check reads only
the lines a PR adds, in the pronoun check's shape, and counts the rest. B gets no failing check
at all, because a descending sort is right on a feed and nothing but the surface can say which
list is a feed. A's lint needs its allow-list of view toggles or *Show all 12* fails. D's check
is strict and safe only because its codemod fixes every legacy site in the same PR, the
theme-tokenize model: nothing left to fail on.

**Some rules are better taught than enforced.** B's thresholds are a design decision per
surface, so the rule lives in the Glossary and in each kernel's test, and the sweep's job is to
make the next surface copy the dispatch pattern. A's held list is design too; the lint only
holds the label. C's sentence belongs in `CLAUDE.md` and the Glossary, where today it is
nowhere, and that line may do more than the component.

**Is D's codemod honest for customers?** Not everywhere. A plain-object branch in the formatter
would put *new row violates row-level security policy* on a customer's phone. So the codemod
skips the nine public pages and the portal cards, and their voice is a hand PR with one shared
helper that returns the class and nothing else. The owner should say whether a customer ever
reads a server's words. The recommendation is never.

**Is E a sweep at all?** No. It is a type change and 15 labels, half an hour. It stays in the
plan because the type change is the check, and because a bare *OK* under *Remove your signing
code?* is the smallest example of the rule the owner named.

**Should the four run as one PR?** No. Each is a mechanical change across many files, and the
repo's rule is that such a change merges alone, cut from fresh main, before the next feature PR
on those surfaces. Five sweeps are five mornings.

## 4. The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/consistency-sweeps/mockup.html`. Desktop
width, one phone panel. For each rule two real sites, drawn before and after with the file
named under each: Schedule → Share's *Send now* beside *Send to 3 · 1 has no email*, the Ask
sheet's dead *Save 4 answers* beside *Save 3 answers · 1 held*; the Estimator inbox newest first
beside oldest first with its amber chip, the Checklist review inbox the same; *No estimates yet.*
beside the New estimate press, the Bids picker's *No bids match your search.* beside the clear
press; the Checklist's *Failed to delete* beside the reason, and on the phone the Sub portal's
*Something went wrong* beside the offline copy with Retry and the server sentence; the signing
code's *OK* beside *Remove the code*. Every customer, job, amount and name is made up: Ridgeway
Builders, Cedar Bend Holdings, Pruett & Vance, Hartline Mutual, Marisol, Todd.

## Decisions for the owner

1. **The order.** D · E · A · B · C is the recommendation. A different first is fine; the one
   constraint is that D's kernel PR lands before D's codemod.
2. **A customer's error words.** Class only, never the server's words, is the recommendation.
   The codemod skips the public pages either way; this decides what the hand PR writes.
3. **C's check.** Diff-only, as proposed. Or none, and the component alone. Or strict, which
   blocks every PR on 322 files until the words are rewritten.
4. **B's thresholds and the three exemptions.** The proposed days are guesses beside the
   precedents and are one constant each. Prospects' calling modes, the price-matrix queue's hours,
   and the Messages family's flat amber *Our move · 2 h ago* each need a yes or a no.
5. **The sentence for C.** Today no doc holds it. The recommendation: a Glossary entry *Empty
   state* and one clause in `CLAUDE.md` → Working conventions, written in the component's PR.

## Where it plugs in

- **D:** `src/utils/errorHandling.ts` (`formatErrorMessage`, `describeClassifiedError`,
  `classifyResultError`, `errorKindOf`), `src/utils/errorHandling.test.ts`,
  `src/lib/offlineRecoveryState.ts`, `src/components/OfflineRetryPanel.tsx`,
  `scripts/codemods/error-reason-sweep.mjs` (new, the `dialog-role-sweep.mjs` shape),
  `package.json` `check:error-words`, `.github/workflows/deploy.yml`, `docs/TROUBLESHOOTING.md`,
  `CLAUDE.md`.
- **E:** `src/contexts/ConfirmDialogContext.tsx`, `eslint.config.js`, the 11 files.
- **A:** `src/lib/batchWords.ts` (new) with its test, `scripts/codemods/batch-label-sweep.mjs`
  (new), `check:batch-words`, the 19 files, `CLAUDE.md`'s existing clause gains the kernel's name.
- **B:** `src/lib/ageState.ts` (the new constants), the ten kernels and their tests, two
  migrations with `lock_timeout` and their `docs/migrations/` notes, `docs/GLOSSARY.md` → *Amber /
  red age*, `scripts/check-waiting-order.ts` (new, warning only).
- **C:** `src/components/EmptyState.tsx` (new) and its render smoke, `src/lib/emptyWords.ts` (new,
  the words kernel from `deckWords`' shape), the four `emptyMessage` props,
  `scripts/codemods/empty-state-sweep.mjs` (new, the clear-the-search press),
  `scripts/check-empty-words.ts` (new, the pronoun check's shape), `docs/GLOSSARY.md`, `CLAUDE.md`.
- Every sweep PR: a release note and a `docs/recent-features/` fragment; the guides that quote a
  button whose label changes (*send lien notices*, *run the office day with Quickfill*,
  *answer everyone waiting on us*) are re-read for the new words.

## How to verify

Each sweep's PR runs its own `--check` green on the swept tree and red on a one-line revert, the
way the dialog-role sweep was proved. D: as the dev, delete a checklist item the sample assistant
cannot, and read *You don't have permission to delete checklist items.* in place of *Failed to
delete*; turn wifi off on a phone, open the dock's Home, and read the offline copy with Retry,
then turn it on and press it. A: open Schedule → Share with one person who has no email and read
*Send to 3 · 1 has no email* with the name under it. B: open the Estimator inbox with a request
older than three days and read the amber chip at the top of the list. C: search the Bids picker
for a word no bid has, press *Clear the search ▸*, and read the list back. E: Settings → Your
account → the signing code's Remove, and read a button that names the act. Nothing on prod from
a test press.

## Where it stands

Proposed 2026-10-26. The sites were found by grep and read by four subagents, then the ones
drawn were read again. Not verified: the surface column's page → tab path for a few windows,
which was inferred from the component's openers, not clicked through; whether the server-side
batches (`schedule-share-dispatch`, `bulk_approve_accounting_label_suggestions`) stop or
continue on one bad row; and about one in ten of the 314 empty-state rows inside windows, whose
kind was classified by phrase and sampled, not read one by one.
