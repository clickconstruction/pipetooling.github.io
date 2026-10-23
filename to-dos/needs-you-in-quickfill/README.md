---
name: "Needs you in Quickfill — the office-set lines the Dashboard has and Quickfill does not, and a fill-in deck for the ones an assistant clears with a few fields"
number: 146
group: gated
status: the owner's yes 2026-10-23, all three calls as recommended; PR 1 (v2.5771, the shared gates, hook and door table) and PR 2 (v2.5774, the deck shell with lost bids) built the same day; PRs 3 to 5 next
summary: >
  The Dashboard's Needs you card listed 30 lines today. Quickfill has carried the same card as its last
  station since v2.2350, drawn by the same builder, but the two hosts hand the builder different inputs:
  the Dashboard host wires 30 sources the Quickfill host does not. Two are carried by Quickfill's own
  stations and four were turned off on purpose; 24 were never wired. Nine lines on today's card are
  office-set work an assistant can do and never reach Quickfill (returned checks, the contract sweep,
  contracts out for signature, jobs that bought with no job account, test reports ready to send, the
  three Messages lines, the robot blocked on a folder). Separately, four line kinds are cleared by typing a few
  fields per row, and today each one is a door to a different page: lost bids with no reason, vehicles
  with no record, jobs that bought with no job account, contracts out for signature a week. The proposal
  is two moves. One, both hosts read their inputs from one hook, so the drift cannot recur. Two, the
  Quickfill station gains a fill-in deck: one row at a time, the fields for its kind, Save and next,
  Skip, a saved trail with Undo, a done count.
next: PR 3, the vehicle kind on the deck.
size: M as a train of five (S the hook, S the deck shell with lost bids, S vehicles, S job accounts, S contracts); no migration, no edge function
blocker: none
ver: proposed
opinion: build PR 1 whatever else is decided — nine office lines are missing from the page the office works from, and the fix is a hook both hosts call; the deck is worth it for lost bids alone (60 rows, $5.9M unexplained) and the other three kinds ride the same shell
mockup: to-dos/needs-you-in-quickfill/mockup.html
---

# Needs you in Quickfill (#146)

## The ask in the owner's words

Robert, 2026-10-23, looking at the Dashboard's Needs you card: some of these items should be workable in
Quickfill by an assistant, but are not. Which ones, and what should the Quickfill modal for them look
like so an assistant fills them out fast?

## What the card held today

Read from the live card on a local preview as the dev, 2026-10-23 (the owner counted 29 the day before;
one line came and one went). Every number is prod's and stays out of the mock-up.

| # | Line (key) | Who sees it on the Dashboard | Door | On Quickfill's Needs you station | An assistant can clear it today |
|---|---|---|---|---|---|
| 1 | Bulk deletions detected (`bulk-delete`) | dev | Settings → Recently deleted | dev only | no, dev |
| 2 | 3 checks came back (`returned-check`) | office set | Accounts Receivable | **not wired** | yes, on AR |
| 3 | GC review is still due this week (`gc-review-weekly`) | office set | GC Review | own station (GC weekly review) | yes |
| 4 | 65 purchases need a job (`tally-self`) | everyone, their own card | /tally | yes | yes, their own |
| 5 | 2 GC statements are ready to send (`statement-round`) | office set | GC Review round | the GC weekly review station | yes |
| 6 | Next lien deadline Nov 16 (`lien-notice-draft`) | office set | Lien desk | yes | yes, drafting is office work |
| 7 | 92 bank-label suggestions (`label-approvals`) | controller, master, dev | Banking → Accounting | yes, same roles | controller yes, assistant no (cannot read the bank) |
| 8 | 85 live jobs have no contract (`contract-missing`) | office set | the Contract sweep | **not wired** | yes, the sweep is a worked list |
| 9 | $4,042 on 10 current invoices (`job-account-window`) | office set | the move window's worked list | yes (v2.5723) | yes |
| 10 | Approve 3 lien notices (`lien-notice-approve`) | master, dev | Lien desk → Awaiting | leader only | no, the leader's call |
| 11 | 2 jobs are waiting on a follow-up (`job-followups`) | office set | Follow-ups deck | own station (Job follow-ups) | yes |
| 12 | 2 people are waiting on us (`gc-follow-up`) | GC office team | Messages → Follow up | **not wired** | yes |
| 13 | 2 Collections accounts await your review (`legal-review`) | dev | Legal desk | **not wired**, dev | no, attorney-ready is the owner's mark |
| 14 | 1 test report is ready to send (`test-reports-ready`) | office set | the Job window | **not wired** | yes, Send to the GC |
| 15 | Customers · 1 we owe (`customer-messages`) | GC office team | Messages | **not wired** | yes |
| 16 | Today's sends · 1 text (`todays-sends`) | GC office team | Messages | **not wired** | yes, one press |
| 17 | 23 clock sessions waiting on approval (`hours-approvals`) | office set | People → Hours | **off by design**; the People Hours station carries the same approvals | yes, the office approves |
| 18 | Team reviews due (`team-reviews`) | the reviewer | Hiring → Review | yes | their own |
| 19 | 21 robot questions and 40 audits (`robot-audits`) | audit roles, assistant included | Bids → Audits | **off by design** | role yes, judgement no |
| 20 | 14 won bids have no submittal started (`submittal-not-started`) | office set + estimator | Submittals | **not wired** | no, the estimator builds Rev 1 |
| 21 | The robot has sealed numbers on 5 bids (`robot-locked`) | audit roles | Robot Board | **not wired** | not work, a head start |
| 22 | 5 field reports waited 3+ days (`hr-reports-pending`) | dev | People → HR | yes, dev | no, HR is dev only |
| 23 | The robot is blocked on 5 bids (`robot-blocked`) | audit roles | the needs sheet | **not wired** | yes, sharing a folder is clerical |
| 24 | A contract out for signature a week (`contract-stale`) | office set | Stages, contract = sent | **not wired** | yes |
| 25 | Hours typed by hand want a second look (`typed-hours`) | office set | People → Hours, typed | **off by design**; same station as 17 | yes, a second person |
| 26 | 1274 fixture names have no Division 22 code (`d22-uncoded`) | dev, estimator | Pricing → D22 audit | **off by design** | no, the ledger-teaching roles |
| 27 | 60 lost bids have no reason (`lost-bids`) | office set + estimator + primary | Bids → Why we lost, call mode | yes | yes, by a door |
| 28 | 50 jobs bought parts with no job account (`job-account-missing`) | office set | Materials → Job accounts | **not wired** | yes |
| 29 | 3 vehicles missing a record (`vehicle-records-missing`) | dev, assistant, controller | People → Vehicles | yes (v2.4700) | yes, by a door |
| 30 | Farm 1 · 56 roadmap tasks (`roadmap-needs-person`) | dev | the Plan | dev only | no, the owner's |

The 31 other line kinds the builder knows were not on the card today. Their gates and doors are in
`buildNeedsYouItems` and the two hosts. The ones that matter for this question: `lien-unconditional`,
`demand-deadline`, the lien watches, `owner-records-signed`, `docsmit-credit`, `customer-waiting`,
`dispatch-requests-aged` and `ar-deposits` are all wired on Quickfill already and are office work.
`paid-claims-stale`, `bid-followups`, `capacity-under`, `jobs-stale-open`, `work-orders-unpriced`,
`legal-firm-activity`, `price-matrix-ready`, `price-requests-late`, `bulk-hours` and `contract-clauses`
are office-set or wider on the Dashboard and not wired on Quickfill. `lien-waivers-to-sign`,
`lien-notice-sign`, `lien-notice-batch`, `robot-asleep`, `robot-backlog`, `robot-answered`, `claim-dev`
and `money-on-my-bids` are the leader's, the dev's or the estimator's and stay off Quickfill.

## What the table says

**One builder, two hosts, and the hosts drifted.** The promise of v2.2350 was that Quickfill's station
cannot lag the Dashboard, because both draw from `buildNeedsYouItems`. That holds for the words and the
order. It does not hold for the inputs. Each host wires its own hooks and passes its own flags, and
since v2.2350 the Dashboard host has gained 30 sources the Quickfill host does not pass. Two are carried
by Quickfill's own stations (Job follow-ups, GC weekly review), four were turned off on purpose with a
comment, and 24 were never wired. Nine lines on today's card are office-set work an assistant can act
on, so the office's own page is missing them:

- returned checks (`returned-check`)
- the contract sweep (`contract-missing`) and contracts out for signature a week (`contract-stale`)
- jobs that bought parts with no job account (`job-account-missing`)
- test reports ready to send (`test-reports-ready`)
- the three Messages lines (`gc-follow-up`, `customer-messages`, `todays-sends`)
- the robot blocked on a folder (`robot-blocked`, shown to the audit roles, which include the
  assistant; it rides the robot-audits flag, so turning it on means splitting that flag)

The four turned off by a comment, not a gate: hours approvals and typed hours ("a people-desk
concern"), robot audits ("Quickfill is the billing desk"), Division 22. Hours approvals is
the one worth revisiting: the People Hours station on the same page carries exactly those approvals for
the same roles, so the line can expand that station the way the dispatch line expands the Dispatch inbox
station today. The other three are right as they are.

**Four kinds are fill-in work and today each is a door to a different page.** An assistant clearing
them walks four surfaces. Each row's clear is a handful of fields the app already knows how to write:

| Kind | The row | The fields | The write that exists |
|---|---|---|---|
| Lost bid, no reason (`lost-bids`) | the bid, the GC, the amount, lost when | one of six reason chips, what they said, who you talked to | the bid's `loss_category` + `loss_reason`, a contact-log stamp (the call-mode kernel `builderCallSession.ts`) |
| Vehicle, missing record (`vehicle-records-missing`) | the truck, who drives it, which record is missing | insurance: plan, start, end · registration: expires · service: date, odometer, what | `vehicle_insurance_periods`, `vehicles` registration, `vehicle_service_events` (the Vehicles tab's inserts) |
| Bought with no job account (`job-account-missing`) | the job, the house, the dollars | one of three: on our account there (tick the invoices), ask the house to move it, no account there | the invoice job-account flag, `supply_house_invoice_move_requests`, a note (the Job accounts tab's writes) |
| Contract out a week (`contract-stale`) | the job, the customer, sent when | one of four: resend, text the link, signed on paper, called | the Contract sweep's resend and text, the sweep's mark-signed with a file, a contact note |

The contract sweep (`contract-missing`) already is this shape: a row, a pane, **Send & next**. It stays
its own modal and the station opens it in place.

## The decision proposed

**Move 1, the hook.** One `useNeedsYouInputs({ host: 'dashboard' | 'quickfill' })` that owns every
hook and every gate, and returns the `NeedsYouInputs` the builder takes. The two hosts call it and
keep only what differs: Quickfill turns off the lines its own stations carry (`job-followups`,
`gc-review-weekly`) and passes its page's Dispatch inbox opener; the Dashboard keeps `hideBanners`.
A test holds the rule the hook makes true: every input the Dashboard host enables for the office set,
the Quickfill host enables too, unless a named station carries it. Today that test fails on nine lines.

**Move 2, the fill-in deck.** On Quickfill's Needs you station, beside Cards and Walk the list, a third
view: **Fill them in**. It walks the rows behind the fill-in kinds, one row at a time, in the card's
own worst-first order. Each row shows its sentence, what the app already knows, the fields for its kind,
**Save and next**, **Skip**, and the door to the record for the cases the fields do not cover. Saved rows
collect in a trail under the card with Undo, as the Property kinds station does. The count reads
*3 of 12 · 2 saved*. The station's Mark still stamps the ritual. One shell, four kinds, each kind a
kernel: the rows it reads, the fields it offers, the write it makes.

**Not proposed.** A Quickfill door for the leader's approvals, the dev's data-safety lines, HR, the
Division 22 codes, the robot audits and the submittals. The role may allow some of them. The work is a
judgement the owner or the estimator makes, and a fast fill-in would make it faster to get wrong.

## The owner's calls

1. **Hours approvals on the Quickfill station**: a line that expands the People Hours station, or leave
   it off as the v2.2671 comment chose. Recommended: the line, since the station is already there.
2. **Where the deck lives**: a third view on the Needs you station (recommended, one place for all of it,
   and the Walk view already has the shape) or four new stations with inline rows (Quickfill's native
   shape, four PRs, four marks to keep).
3. **Lost bids first, or vehicles**: the deck ships kind by kind. Lost bids has the biggest pile and the
   smallest fields. Vehicles has three.

## The mock-up

`mockup.html` beside this file. Four frames: the station header with the third view, the deck on a
lost bid, the same shell on a vehicle, a job account and a contract, the saved trail, and the phone.
Every GC, job, truck and amount in it is made up.

## Where it plugs in

- `src/lib/dashboardNeedsYou.ts`: `buildNeedsYouItems`, `NEEDS_YOU_RANK`, the `NeedsYouInputs` type.
  Unchanged by Move 1. Move 2 adds nothing to the builder; the deck reads rows, not lines.
- `src/components/dashboard/DashboardPinnedQuickRow.tsx` and
  `src/components/quickfill/QuickfillNeedsYouSection.tsx`: the two hosts. Move 1 moves their hook
  calls into one hook under `src/hooks/useNeedsYouInputs.ts` and leaves the two `onAction` switches,
  which already match line for line where both have the line.
- `src/components/dashboard/DashboardNeedsYouCard.tsx`: Cards and Walk. Move 2 adds the third view
  on the Quickfill host only, through a prop, so the Dashboard card does not change.
- The four writes exist: `builderCallSession.ts` (lost bids), `PeopleVehiclesTab.tsx`'s three inserts
  (vehicles), `MaterialsJobAccountsTab.tsx`'s flag, ask and note (job accounts), the Contract sweep's
  resend, text and mark-signed (contracts). Each becomes a pure kernel with a test before the deck
  calls it.
- The rows come from the hooks the lines already read: `useLostBidNudge`, `useVehicleRecordGapsNudge`,
  `useJobAccountEvidenceGapsNudge`, `useJobContractsNudge`. Each returns a count today; the deck needs
  the rows, so each gains a `rows` read or a sibling hook.
- Docs: `DASHBOARD_SECTIONS_ARCHITECTURE.md` (the items table gains a Quickfill column),
  `QUICKFILL_ARCHITECTURE.md` (the `needs-you` station, the third view), `ACCESS_CONTROL.md` (no new
  gate; the deck shows a kind only to the roles its line already has). A guide, *clear the Needs you
  list in Quickfill*.

## The plan

1. **PR 1, the hook** (S): `useNeedsYouInputs`, both hosts on it, the parity test, the nine lines on
   Quickfill. No screen changes beyond the lines appearing. Ships without the deck.
2. **PR 2, the deck shell + lost bids** (S): the third view, the walk, Save and next, Skip, the trail
   with Undo, the count; the lost-bid kernel and rows.
3. **PR 3, vehicles** (S): the kind's fields by which record is missing; the three inserts as a kernel.
4. **PR 4, job accounts** (S): flag, ask, leave; the tab's writes as a kernel.
5. **PR 5, contracts out a week** (S): resend, text, signed on paper, called; the sweep's writes reused.

## How to verify

As the sample assistant on prod after PR 1: Quickfill → Needs you shows the same office lines as the
Dashboard shows the same account, less Job follow-ups and GC review, which have their stations. The
parity test names any line that differs. After PR 2: **Fill them in** walks the lost bids, a saved
reason shows on the Why we lost lens and in the bid's contact log, Undo removes both. ZZ test bids
(b398 and its siblings) are the rows to use.

## Is this the best we can do, and are we being straightforward?

- **The drift is the finding, not the list.** Nine lines missing from Quickfill is what the owner saw.
  The cause is that two hosts wire their inputs by hand. Adding nine lines to the Quickfill host fixes
  today and leaves the next one to drift. The hook fixes the cause and a test keeps it fixed.
- **The deck is Quickfill's Walk view with fields in it.** Nothing new in shape. The Property kinds
  station already has the saved trail with Undo, the Contract sweep already has Send & next, and the
  card already walks worst first. The mock-up borrows all three.
- **We did not count the assistant's view live.** The card was read as the dev. The table's
  "an assistant can clear it" column is from the gates in code, not from a live walk as the sample
  assistant. The verify step does that walk.
- **Four kinds, not more.** `job-account-window` already has a worked list, the lien lines have the
  desk, Messages has its desk. We only put in the deck what has no worked list today.
- **The role allows more than we propose.** The assistant is in the robot audit roles and the hours
  approvers. We left audits out on purpose and said why. Hours approvals is the owner's call 1.
- **What this does not do.** It does not make an assistant able to approve lien notices, mark an
  account attorney-ready, or file HR reports. Those gates are right.

## Where it stands

2026-10-23: the owner said *I like it. Please build it.* The three calls are taken as recommended: the
clock-sessions line expands the People Hours station, the deck is a third view on the station, lost
bids first. PR 1 is v2.5771: `needsYouSources.ts` (the gates and the parity test), `useNeedsYouInputs`
(one hook, both hosts), `needsYouDoors.ts` (one door table, exhaustive) and `useNeedsYouPress` (one press,
the five windows). The Dashboard host lost ~500 lines and reads the same. PR 2 is v2.5774: the deck shell (`lib/needsYou/fillIn.ts`, `NeedsYouFillInDeck`, the card's `fillIn` prop, `useFillInRows`) and the lost-bid kind, walked live as the dev at desktop and phone width; Save was exercised through the deck's injected io, since prod has no ZZ lost bid without a reason. PRs 3 to 5 follow, a kind each.
