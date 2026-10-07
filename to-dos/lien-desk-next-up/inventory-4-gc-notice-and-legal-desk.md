# 4 · Put a GC on notice, and the Legal desk

Read-only inventory, nothing changed. All paths are under the repo root.

File keys used in the `file:line` column:

- **M** = `src/components/jobs/GcOnNoticeModal.tsx`
- **B** = `src/components/jobs/GcNoticeJobsBand.tsx`
- **W** = `src/components/jobs/GcNoticeWrongList.tsx`
- **P** = `src/components/jobs/GcNoticePreviewModal.tsx`
- **S** = `src/components/jobs/GcNoticeStepShell.tsx`
- **R** = `src/components/jobs/LienDeskRunModal.tsx`
- **WR** = `src/components/jobs/LienWordRecordRow.tsx`
- **L** = `src/components/jobs/legal/LegalDeskModal.tsx`
- **K** = `src/components/jobs/legal/LegalPortalLinkButton.tsx`
- **F** = `src/components/jobs/legal/LegalFirmMatterView.tsx`
- **A** = `src/components/jobs/AgreedWriteDownModal.tsx`
- **T** = `src/components/jobs/LienTimelineStrip.tsx`
- **Host** = `src/components/jobs/JobsStagesTab.tsx`

Role gates as the code defines them (`src/lib/jobs/lienDesk.ts:287-297`, `src/lib/jobs/stagesRoleGates.ts:18,69`):

- **office** = dev, master_technician, assistant, controller
- **leader** = dev, master_technician
- **word** = dev, assistant, controller
- Legal desk: `canEditReview` = office; `canMarkReady` = dev only (Host:4408-4409)

The Legal desk files are in `src/components/jobs/legal/`, not `src/components/jobs/`. `LegalPortalLienGrid.tsx` is not imported by the desk; only the firm's page `src/pages/LegalPortal.tsx:149` uses it.

---

## Window 1 — Put a GC on notice

**98 rows** (header 6, brief 3, jobs band 15, Owners 13, Claims 16, Cover letter 5, Decision 7, Grid 2, footer 9, preview 7, run window 15).

| Area | What the user can do | Control as labelled on screen | Who | Writes data? | file:line |
|---|---|---|---|---|---|
| Open | Open the window with the GC already picked; it reads every job with unpaid work under that GC | Entry buttons outside the window: `Put {GC} on notice…` (Pipeline tools), `⚠ Put a GC on notice…` (Lien desk) | office (Host:1489) | no | Host:3067, 4549-4568; M:200 |
| Header | See the loading or empty state | `Reading every job with unpaid work under {GC}…` / `No job with unpaid work names {GC} as its GC. Nothing to send.` | anyone in the window | no | M:708-711 |
| Header | See whether this GC has been noticed before | chip `first notice we've sent them` / `noticed before` | anyone | no | M:684 |
| Header | Fold or unfold the one-paragraph explanation | `▸ What this does` / `▾ What this does` | anyone | no (not remembered) | M:685-699 |
| Header | Fill the screen or return to a window; hidden on a phone | icon button, label `Full screen` / `Back to a window` | anyone | no (remembered in localStorage, key `gc-on-notice`) | M:197, 702; `src/lib/modalFullScreen.ts:20-21` |
| Header | Close the window | `×` (aria `Close`); a click on the backdrop also closes | anyone | no | M:670, 703 |
| Step bar | See five steps with number or ✓, name and live status; the step in view is lit | `Owners` · `Claims` · `Cover letter` · `Decision` · `The grid` | anyone | no | S:50-75; M:714; `src/lib/jobs/gcOnNoticeSteps.ts:53-105` |
| Step bar | Jump to a step with a smooth scroll | click a step | anyone | no | S:59; `src/hooks/useGcNoticeStepSpy.ts:30-41` |
| Brief | See the total open with the GC, split by open on bills and not yet billed | `Open with {GC}, across N jobs` + split bar + `$X open on bills · N jobs` / `$Y not yet billed · N jobs · claims the contract balance` | anyone | no | M:717-731 |
| Brief | See the GC's standing facts | `Their word` (`✓ promised {date} · {name}` / `No live promise`), `Standing rule`, `Payment terms`, `Legal desk`, `Unpaid work`, `Next window` (red inside 7 days, `— a run recorded today keeps it`) | anyone | no | M:732-751 |
| Brief | Be warned that a live promise sends these to the leader either way | `A live promise: the desk would send these to the leader either way — "paper, or their word".` | anyone | no | M:752 |
| Jobs band | Fold or unfold the jobs table | `Hide the jobs ▴` / `Show the N jobs ▾` | anyone | no (remembered, localStorage `gcNoticeBandOpen`) | B:108, 153-158, 269-271 |
| Jobs band | See jobs per stage and the band's money totals | `Waiting 4 · Working 1 · Billed 17` pattern; `$ job total`, `$ billed ($ unpaid)`, `$ paid`, `$ done, not billed` | anyone | no | B:273-283 |
| Jobs band | Open the list of jobs that look wrong: hover on desktop, or click to pin it | `N look wrong ▾` / `1 looks wrong ▾`; `every record reads right` when none | anyone | no | W:97-124; B:277 |
| Jobs band | Pick a job in that list; the band unfolds if folded, scrolls to the row and lights it for about 2 seconds | list items `{job} · $open · {stage} · {readings}` under `Click a job to jump to its row` | anyone | no | W:143-157; B:139-146, 159-165 |
| Jobs band | Close the list without picking | Esc (closes the list only), a click elsewhere, or a second click on the count | anyone | no | W:54-70, 107-114 |
| Jobs band | Change the order of the rows | `by stage` / `biggest open first` / `by property` | anyone | no (remembered, localStorage `gcNoticeBandOrder`) | B:107, 149-152, 285-291; `src/lib/jobs/gcNoticeJobsBand.ts:362-366` |
| Jobs band | See each group's header: label, job count, dollars open | `{stage chip or label} N jobs · $X open · …` (groups: stages, `Every job`, an address, `No address on the job`) | anyone | no | B:310-321, 337-345 |
| Jobs band | Open a group's own wrong list; with exactly one wrong job the count jumps straight to its row | `N look wrong ▾` or `1 looks wrong ↓`; `all read right` | anyone | no | B:317; W:89-95 |
| Jobs band | Open a job from its row (the Job window on its Job tab); the run stays where it is | row click, `Open ↗`, title `Open the job` | anyone | no | B:166, 213, 242; Host:4565 |
| Jobs band | Click a "looks wrong" chip to open the job on the field that fixes it | patterns: `Waiting, but {N% done / a bill out / a draw paid} → Status ▾`; `Working, but 100% done and billed → Status ▾`; `set % done → % done`; `$X done, not billed → Bill it`; `quiet N d → Open`; none = `✓ reads right` | anyone | no (the write happens in the Job window) | B:174-183; `src/lib/jobs/gcNoticeJobsBand.ts:251-275` |
| Jobs band | Click a line item to open the bill at ① Line Items | line button `{name} · $price · {paid / billed / part paid · part billed / done · not billed / not started}` | anyone | no | B:185-198 |
| Jobs band | Click the Progress & payment bar to open the job's line items | the Pipeline's progress cell | anyone | no | B:202-206 |
| Jobs band | See each job's tiles and open amount | `Total` · `Billed` · `Paid`; open amount with `on bills` / `nothing billed yet` / `$X on bills · $Y not billed` / `nothing open` | anyone | no | B:207-215, 247-257 |
| Jobs band | See the job's address and last day on site | `last on site {date}` | anyone | no | B:216-222 |
| Jobs band | Have the band and all steps re-read after a job opened from here is saved | automatic | anyone | no | M:202-204; Host:4564-4565 |
| Step 1 Owners | Have every property without an owner looked up on the appraisal roll as the window opens, with progress | `Looking up X of Y on the appraisal roll…`; row `waiting for the roll…` | automatic | no (uses the lookup cache) | M:283-308, 763, 813 |
| Step 1 | Take every owner the roll found, in one press | `Use all found · N ▸` → `Saving X of Y…` | office | yes: `customer_addresses` owner fields; may insert an address and link `jobs_ledger.customer_address_id` | M:378-393, 766-770; `src/lib/jobs/ownerConfirmWrite.ts:122-180` |
| Step 1 | See how many owners are on file | pill `✓ N of M on file` | anyone | no | M:771 |
| Step 1 | Fold or unfold the owners table; it folds itself when every owner is settled | `Hide the owners ▴` / `Show the N owners ▾`; banner `Every job has an owner of record on the job. Nothing to do here.` | anyone | no (not remembered; resets each open) | M:239, 274, 634, 775-780 |
| Step 1 | See the rows that need someone first | automatic sort | anyone | no | M:635; `gcOnNoticeSteps.ts:241-247` |
| Step 1 | See each job's owner state | `✓ {owner}` + `on the job`; `✗ missing` + `not looked up`; `✗ No parcel under the pin` or a lookup error | anyone | no | M:803-833 |
| Step 1 | Take one found owner; one press covers every job at that property | `Use` → `Saving…`; disabled when a "reads as" chip rules it out | office | yes: same as Use all found, one property | M:367-377, 838-842 |
| Step 1 | See what the roll said and how it reads against the job | "reads as" chips; `the roll says · {source}`; `· one Use covers N jobs here`; `· no mailing address on the roll` | anyone | no | M:816-819 |
| Step 1 | Open the county appraisal district's page for the parcel | `this parcel on {county} CAD ↗` / `{county} CAD ↗` | anyone | no (external browser) | M:797, 820 |
| Step 1 | Open the job to find an owner the roll could not place | `Find the owner ›` | anyone | no (opens Edit Job, no focus passed) | M:828 |
| Step 1 | Type the owner and mailing address by hand and save | inputs `Owner name…`, `Mailing address…`, button `Save` | office | yes: `customer_addresses` (owner company and mailing address) | M:394-416, 843-849 |
| Step 1 | Confirm an owner that came from the roll unconfirmed | `Confirm`; row says `from the roll · unconfirmed — the run refuses to record until someone confirms it` | office | yes: `customer_addresses.owner_confirmed_at/by` | M:417-430, 811, 837; `ownerConfirmWrite.ts:188-192` |
| Step 1 | See a public owner left out of the run | chips `public owner — bond claim, not a lien`, `excluded`; `left out of the run · talk to the attorney` | anyone | no | M:809, 836 |
| Step 2 Claims | Preview every notice from the first one | `Preview the notice ›` / `Preview all N ›` | anyone | no | M:869-873 |
| Step 2 | See the step's status | pill `N notices · $X` / `nothing ready yet` | anyone | no | M:874 |
| Step 2 | Be told when property kind is not set and commercial dates are assumed | `Property kind isn't set on N of these M jobs.` … `Answer it on the row — the dates follow.` | anyone | no | M:878-882 |
| Step 2 | Click anywhere on a row to read that job's notice; only rows with an open window | row click | anyone | no | M:897 |
| Step 2 | Read one job's notice from its row link | `Preview ›` | anyone | no | M:902 |
| Step 2 | Link a property when the job has none | `link a property ›` | anyone | no (opens Edit Job on Property record) | M:908 |
| Step 2 | Answer the property kind on the row; every job at the address follows and the dates re-read | switch `Residential` \| `Commercial`; `saving…`; shared-property words | office | yes: `customer_addresses.property_kind` | M:433-447, 909-915; `src/lib/jobs/propertyKindWrite.ts:12-15` |
| Step 2 | Reopen the switch on a kind already answered | `change` | office | no until a pick | M:920 |
| Step 2 | See where the job's desk item stands | chips `approved · in the run`, `awaiting the leader`, `held · folded into this run` | anyone | no | M:925 |
| Step 2 | Click an open month to read the notice with that month ringed; see its deadline and days left | chip `{Mon} by {date} · N days` (red inside 7 days); `None open`; `every month is already noticed (…)` | anyone | no | M:928-939 |
| Step 2 | See that a job is dated from its creation month | the `DATED_FROM_CREATION_WORDS` line | anyone | no | M:940 |
| Step 2 | Click a closed month to read the notice; hover for its words | dotted-underline month names under `Window closed · named as information` | anyone | no | M:942-949 |
| Step 2 | See where letter two stands | `Letter two` column chip | anyone | no | M:950-958 |
| Step 2 | See the affidavit deadline or that it has closed | `Affidavit by` column: date / `closed {date}` (red) / `—` | anyone | no | M:959-962 |
| Step 2 | See what each notice claims | `$X`; `includes {months} · windows closed`; `no notice` + `every window closed · $X still owed`; `open on bills`; `unbilled · contract balance` | anyone | no | M:963-988 |
| Step 2 | See a claim set by hand, by whom, and when it is over the balance | chip `set by hand` / `set by hand · over the balance — the leader decides`; hover says who set it; delta words under it | anyone | no | M:976-981 |
| Step 2 | Jump to the Pipeline's capable list to bill finished work first | `Bill the finished work first ›` | anyone | no | M:985. The host does not pass `onOpenCapableList` (Host:4553-4568), so this link never shows today |
| Step 2 | See totals for the run | `N notices`, `N jobs left out · every window closed · $X still owed`, `N open windows`, `N named as information`, total claim | anyone | no | M:992-999 |
| Step 3 Cover letter | Include or leave out the cover letter for the whole run | checkbox `Include the cover letter` (default on) | office | no until approval (then `cover_note` and `fields.coverLetter` on each desk item) | M:225, 1014-1016, 486-489 |
| Step 3 | Switch between the letters for the property kinds present in the run | tabs `Commercial` / `Residential` / `Homestead`; only kinds with a ready job show | anyone (disabled while the unresponsive tick is on) | no | M:325-332, 1022-1036 |
| Step 3 | Swap all three for the "GC is not answering" letter | checkbox `{GC} is not answering — send the unresponsive letter to every owner` | office | no until approval | M:1037-1039 |
| Step 3 | Edit the letter's wording, per kind or the unresponsive one | textarea, aria `Cover letter — {kind}` / `Cover letter — GC not answering` | office | no until approval; then saved on every notice's record | M:310-320, 333-334, 1043-1050 |
| Step 3 | See the fill codes and counsel's rules | `{{property}}` `{{months}}` `{{amount}}` `{{stale_note}}` `{{contact}}` `{{phone}}` `{{affidavit_month}}` `{{job}}`; card `Counsel's wording · 2026-09-22` | anyone | no | M:1053-1072 |
| Step 4 Decision | Pick the reason for the run | radios under `Why now`: `GC is not paying its subs` (default), `GC insolvency suspected`, `Payment promise broken twice`, `Other…` | office | no until approval (then `fields.batchReason` on every item, and the rule and terms notes) | M:216, 1084-1092; `src/lib/jobs/gcOnNotice.ts:120-136` |
| Step 4 | Type what is known, kept on the record | input `What you know — who said what, when (kept on the record)` | office | no until approval | M:1093 |
| Step 4 | Tick: change the standing rule to send without asking | `Send future notices without asking` · `Standing rule: {from} → send without asking` or `already set` | leader or word (all four office roles); locked for others with `The ticks are the leader's — they apply when he approves.` | on approval: rpc `set_customer_lien_notice_policy` | M:502-506, 1098-1109; `gcOnNoticeSteps.ts:201-209` |
| Step 4 | Tick: wind the account down | `Wind the account down` · `Payment terms: {from} → Winding down` | same | on approval: `customers.payment_terms`, note, set_by, set_at | M:507-519; `gcOnNoticeSteps.ts:210-218` |
| Step 4 | Tick: open or extend the Legal desk matter with every job | `Open a Legal desk matter with all N jobs` / `Add all N jobs to the Legal desk matter` | same | on approval: rpc `legal_matter_save_review` | M:520-528; `gcOnNoticeSteps.ts:219-227` |
| Step 4 | Tick: show each owner their property's bills on their portal; only when the run has owner-customer jobs | `Show each owner their property's bills` · `Owners' portals: their own bills only → their property's bills too` | same | on approval: `jobs_ledger.show_bills_to_other_party`, `jobs_ledger_invoices.shown_to_party` (shared outside, to owners) | M:529-539; `gcOnNoticeSteps.ts:188-198`; `src/lib/jobs/ownerBillShareIo.ts:45-84` |
| Step 4 | See each tick's before and after, and the count of real changes on the step bar | `{label}: {from} → {to}`; `already set`; status `{reason} · N changes` | anyone | no | M:1103; `gcOnNoticeSteps.ts:232-234` |
| Step 5 The grid | Read counsel's spreadsheet, one row per job | columns `Job, Owner, Kind, Last work, Unpaid, § 53.056, § 53.057, Affidavit by, Bond, Paid out, 10% held, Their contract done, Letter two, Pile`; `?` chip; `no call yet`; pile chips A/B/C | anyone | no | M:601-631, 1122-1147; `src/lib/jobs/lienOwnerCall.ts:218-233` |
| Step 5 | Print the grid for counsel | `Print the grid ↗` (toast if the popup is blocked) | anyone | no (print window) | M:1119 |
| Footer | See what the run will take | `N ready now · N more the moment Use all found is pressed · N waits on an owner · N left out (public owner)` · `N envelopes · $X claimed`; `N approved notices already wait in the run.` | anyone | no | M:1173-1179; `gcOnNotice.ts:522-529` |
| Footer | Reopen the run for notices already approved | `Open the run · N ▸` | office | no | M:1183 |
| Footer | Start recording the leader's spoken word | `The leader said to send them…` (note prefilled `the leader, {date}`) | word (dev, assistant, controller) | no yet | M:1184-1186 |
| Footer word row | Say who said it and when | input, placeholder `Robert, today 9:10`, lead-in `Who said it, when, and how:` | word | no yet | WR:36-44 |
| Footer word row | Say how he said it; the last two mean he is at the desk | radios `by phone` · `in person` · `by text` · `he is standing over me` · `he is typing it in`; a line under says what the record will read | word | no yet | WR:45-62, 68; `src/lib/jobs/lienWord.ts:17-23, 53-59` |
| Footer word row | Send every ready notice on his word, apply the ticks and open the run | `Record it and send all N ▸` (disabled without a note); `Cancel` | word | yes: each `job_lien_desk_items` row saved then `approved`, mode `word`, with note and channel; a claim over the balance goes to `awaiting_approval` unless he is present; then the ticks | M:494-495, 1157-1171; `src/lib/jobs/lienDeskIo.ts:67-76` |
| Footer | Send the whole set to the leader for his approval | `Send all N to the leader ▸` | assistant, controller (office and not leader) | yes: desk items saved and set `awaiting_approval`; the ticks are NOT applied and no run opens | M:495, 500, 543-545, 1187 |
| Footer | Approve every ready notice, apply the ticks, open the run | `Approve all N and send the run ▸` | leader (dev, master_technician); the DB trigger refuses others | yes: desk items saved and `approved` (mode `leader`); the four ticks; a carried claim correction marked looked-at | M:452-558, 1188; `lienDeskIo.ts:79-84` |
| Footer | See the result toast and have the run open by itself after the re-read | toast `N notices approved for {GC} · {consequences}. The run is next.` | automatic | no | M:337-342, 540-542 |
| Footer | Recover from a click that stopped halfway; what landed can still be undone | toast `Stopped after X of N` | automatic | partial writes stay | M:549-554 |
| Preview | Walk the notices without closing | `‹` / `›` (aria `Previous notice` / `Next notice`), `N of M`, ← → keys | anyone | no | P:74-86, 121-123 |
| Preview | Close only the preview | `×` (aria `Close preview`), Esc, click on the backdrop | anyone | no | P:81, 106-109, 124 |
| Preview | Switch between the owner's copy and the GC's copy | `Owner's copy` / `GC's copy` + a line saying what that copy carries | anyone | no | P:129-138 |
| Preview | See who it goes to, or that no owner is on the job yet | `To {owner · mail to …}` / `No owner of record on the job yet — Step 1 finds one before this can go.` | anyone | no | P:98, 116-118 |
| Preview | Read the pages as the run prints them: cover letter, § 53.056 form, pay page | page labels + paper; the pay page's bills are fetched per job | anyone | no | P:66-71, 143-150 |
| Preview | See the months the notice names (the clicked one ringed), the claim and the affidavit date | rail `Months this notice names`, `Claim` | anyone | no | P:153-171 |
| Preview | Go and edit the letter | `Edit it in Step 3 ›` (closes the preview, scrolls to Step 3) | anyone | no | P:174; M:1207-1210 |
| Run window | See what the run holds | `Send the run · N notices` (`for M jobs` when combined) + description | office | no | R:195-198 |
| Run window | Undo the approval just made; asks first and lists what goes back and what stays | strip `You just approved these N notices for {GC}. Pressed it by mistake?` + `Undo the approval…`; confirm `Undo the approval for {GC}?` with `Undo the approval` / `Keep the run` | whoever approved, in the same sitting | yes: items back to `drafted` (approval, word, hold and printed stamps cleared); standing rule back; payment terms back; owners' bills hidden again; the Legal desk matter stays | R:202-210; M:561-586; `lienDeskIo.ts:121-146`; `src/lib/jobs/gcNoticeRunUndo.ts:45-68` |
| Run window | See the three steps and which is next | `1 · Print the packet` (✓ once printed) → `2 · Mail them` → `3 · Record the mailing` | office | no | R:211-227 |
| Run window | Combine the jobs at one property into one notice | checkbox `Combine the jobs at one property into one notice` (shown only when some can combine; default off) | office | changes what prints and how it records (one filing per job, one packet id) | R:61-64, 230-238 |
| Run window | See each envelope: who, address, email, how many notices inside; missing recipients in red | `Envelope N · {label} {name}` · `N notices inside` | office | no | R:248-261 |
| Run window | Pick the send method per envelope | select: `certified mail, return receipt` · `traceable courier` · `email (courtesy — mail it too)` (disabled without an email) · `hand delivery` | office | no until record | R:263-267; `src/lib/jobs/lienDeskRun.ts:29-34` |
| Run window | Type each envelope's tracking number, checked as typed | input `9407 1118 …` / `who signed for it`; hint `✓ 20 digits · certified` or `N digits — a certified number has 20`; email shows `sent on record — the email id is the tracking` | office | no until record | R:270-285; `lienDeskRun.ts:367-377` |
| Run window | See each copy inside an envelope and any problem with it | job label, `$X · cover letter`, months, `Copy for: {recipient}`, red problem words | office | no | R:288-302; `lienDeskRun.ts:213-222` |
| Run window | Save where the printed packet lives | `Saved copy`: `Drive link to the packet as printed (optional)` + `note (optional)` | office | on record: goes on every filing | R:309-313 |
| Run window | Set the day the envelopes went out | `Mailed on` (date; defaults to today) | office | on record: `sent_on` | R:314-317 |
| Run window | Print one page per envelope | `Envelope faces` | office | no (print window) | R:153-155, 318-320 |
| Run window | Print the whole packet in envelope order | `Print the packet · N envelopes` | office | no from this window; see Easy to miss | R:143-152, 321-323 |
| Run window | Record the mailing; when some envelopes have no number, record only the mailed ones | `Record the run ▸` / `Record N mailed · M stays in the pile ▸` / `Recording…`; hint line beside it; blocked by `Fix the recipients marked in red before recording.` | office | yes: `job_lien_filings` insert per job; desk item → `sent`; one-shot claim corrections cleared; emails the notice PDF through edge function `send-lien-filing-email` for email-method recipients | R:159-177, 324-329; `src/lib/jobs/lienDeskRunIo.ts:43-99` |
| Run window | Close the run without closing the window behind it | `×`; a click outside | office | no | R:185-190, 200 |
| Run window | Have the unpaid invoices and pay-code pages attached without asking | automatic; the description names the counts | automatic | no | R:66-130 |

### Easy to miss

- **What opens first.** Step 1 folds to one green line only when no owner is missing, unconfirmed or public (M:634). The jobs band opens unfolded and by stage unless the browser remembers otherwise (B:107-108). The letter tab moves to the first kind present in the run (M:330-332).
- **Remembered per browser:** full screen, band open or closed, band order. **Not remembered:** owners fold, What this does, the letter text, the reason, the note, the ticks.
- **The office's work is not carried to the leader's window.** The letter edits, reason, note, ticks and "not answering" tick are local state, seeded from defaults on every open (M:216-226, 310-320). After `Send all N to the leader`, the items stay "ready" (`gcOnNotice.ts:168-175`). When the leader presses Approve all, the drafts are saved again from his window's values (M:461-489). The office's edited letter and reason appear to be overwritten unless he retypes them. Worth confirming before the redesign.
- **The ticks apply at approval, not at recording.** The label says `Also change, when the run is recorded`, but the writes happen inside Approve all and the word path (M:500-539).
- **`Send all N to the leader` never applies the ticks** and never opens the run (M:500, 543).
- **A claim set by hand over the balance** goes to the leader even on the word path, unless the channel says he is present (M:494-495).
- **Undo lives only in this sitting.** The receipt is cleared when the window closes or reopens, and once a run is recorded (M:273, 1222). It also exists after a half-finished approval (M:552).
- **The step bar never lights "The grid".** The scroll spy tracks four keys (M:165), so the bottom of the scroll lights Decision. Clicking The grid still jumps there.
- **Printing from this window's run does not stamp the notices printed.** The Lien desk passes `onPrinted`; this window does not (M:1214-1227 against R:43-44, 151). The guide's "In the mail · tracking owed" pile comes from that stamp.
- **`Bill the finished work first ›` is dead today**; the host passes no handler.
- **Esc** closes the preview or the wrong list only. There is no Esc handler for the main window in this file.
- A row click in Step 2 and in the band skips clicks that land on a button, input or link (M:897; B:242).
- Public-owner jobs are not listed in Step 2 at all (M:888). They are still in the grid and the band.
- A carried claim correction is marked "looked at" by approval (M:497).
- Roll lookups stop when the window closes (M:263-281).
- Opening a job from the band or a door keeps the window mounted; saving the job re-reads the band and the steps (Host:4564-4565).

---

## Window 2 — Legal desk

**79 rows** (open and header 7, rail 4, account header 15, Account tab 7, Paper tab 8, Their word tab 6, Evidence tab 3, Fees & steps tab 10, Mark-ready sheet and preview 7, Firm's emails 3, Firm's link 6, Write-down 3).

| Area | What the user can do | Control as labelled on screen | Who | Writes data? | file:line |
|---|---|---|---|---|---|
| Open | Open the desk from the Collections header; disabled when Collections is empty | `⚖ Legal` | office (`canManageCollections`) | no | Host:3793-3812 |
| Open | Open by link, on one account and on a tab | `/jobs?tab=stages&legal=1` or `legal=<payer key>`, plus `&legalTab=fees` | office roles (`Jobs.tsx:1165`) | no | `src/pages/Jobs.tsx:1174`; `src/components/dashboard/DashboardPinnedQuickRow.tsx:793-795` |
| Open | Open from the Lien desk when a lien right is gone or an affidavit is due | `Refer to the Legal desk ›` / `The Legal desk ›` (closes the Lien desk) | office | no | `src/components/jobs/LienDeskAffidavitPane.tsx:296, 300`; Host:4502-4505 |
| Header | See the desk's title, the firm's name, or that no firm is set up | `Legal · Collections accounts`; `Firm: {name}.` / `No firm yet — add one on Settings → Jobs & dispatch.` | anyone in the desk | no | L:455-456 |
| Header | Open who at the firm gets emails | `✉ Firm's emails` (adds ` · paused`) | office, firm set | no | L:458 |
| Header | Open the firm's portal link dialog | `🌐 Firm's link` | office, firm set | no | L:459; K:91 |
| Header | Close the desk | `✕`; a click on the backdrop | anyone | no | L:449, 460 |
| Rail | See every Collections account and the total | `N accounts · $X · by what Click would keep`; `Loading Collections…` / `Nothing is in Collections.` | anyone | no | L:465-468 |
| Rail | See accounts in three groups, each sorted by what Click would keep; asked-for accounts first | `Needs a dev's eyes · N`, `With the firm · N`, `Closed · N` | anyone | no | L:205-208, 241-245, 472 |
| Rail | Pick an account; the tab returns to Account | card: name, balance, `N jobs · GC pays · N no contract` or `· signed`, `keeps ~$X` or the firm stage, `asked for a dev · `, `Nd in Collections · oldest bill Nd` | anyone | no | L:478-488 |
| Rail | Land on the linked account, else the last one, else the first | automatic | anyone | no | L:223-228 |
| Account header | See the account: name, job numbers, address, balance, oldest bill | — | anyone | no | L:499-511 |
| Account header | See who asked for a dev and their note; see the note sent to the firm | `{name} asked for a dev's eyes Nd ago: "…"`; `Note to the firm: "…"` | anyone | no | L:504-505 |
| Account header | See the readiness verdict | readiness pill (red, amber or green) | anyone | no | L:513 |
| Account header | Print the packet: cover sheet then the five sections | `⎙ Print packet` | anyone | no (print window; toast if blocked) | L:277-280, 514 |
| Account header | Start the release to the firm | `⚖ Mark attorney ready…` | dev only | no until confirmed | L:435-436 |
| Account header | Ask a dev to review | `Ask a dev to review…` | office who cannot mark ready | no until confirmed | L:441 |
| Account header | Take the request back | `Withdraw the request` | office who cannot mark ready | yes: rpc `legal_matter_save_review` (request off) | L:336-339, 439 |
| Account header | Start a write-down on the first job's primary bill line | `Write down…` | office | no until applied | L:254-263, 444 |
| Account header | Start pulling the account back from the firm | `Pull back` | dev only, when with the firm | no until confirmed | L:428 |
| Account header | See where the matter stands | pills `With {firm} since {date} · {stage}`; `{closed stage} {date} · {reason}`; `{name} asked for a dev · Nd ago` | anyone | no | L:427-434 |
| Account header | See that the desk is read-only before the legal tables exist | `Read-only until the legal tables are applied.` | anyone | no | L:423-424 |
| Account header | See load state; retry sources that failed | `Assembling the packet…`; `Couldn't load {names} — those sections read empty here, not in the record.` + `Retry` | anyone | no | L:520-526 |
| Account header | Read the four summary cards | `Theory`, `If every dollar lands`, `Click keeps` (verdict pill), `Against pursuing` | anyone | no | L:528-543 |
| Gap list | Fold or unfold the gap list | `▼ Before this goes to an attorney · N to fix · M to know about`; or `✓ No gaps — an attorney would have everything they ask for first.` | anyone | no (open by default, not remembered) | L:211, 545-562 |
| Gap list | Open the surface that fixes a gap | per-gap button: `Contract…`, `Lien instruments…`, `Edit customer…`, `Edit job…`, `Call mode…`, `Write down…`; pills `fix` / `note` | anyone (the opened surface gates itself) | no | L:176-185, 264-276, 552-557 |
| Tabs | Switch between the five sections | `Account` · `Paper` · `Their word` · `Evidence` · `Fees & steps` | anyone | no | L:61-63, 564-571 |
| Account tab | See who owes: payer, address, emails, phones, terms | `Who owes`; pill `name only — no customer record` | anyone | no | L:730-737 |
| Account tab | Open the customer to edit it; the desk refreshes on save | `Edit customer ↗` / `Link a customer ↗` (the latter opens Edit Job when the payer is a name only) | anyone | no | L:250-253, 725 |
| Account tab | See the contacts | `Contacts` table | anyone | no | L:738 |
| Account tab | See each job: age, basis, balance; open a job to edit | `Jobs in this account`; pills `signed contract` / `sworn account holds` / `needs …`; `Edit job` | anyone | no | L:739-746 |
| Account tab | Go to the job's row on the Pipeline; closes the desk | `Pipeline row ↗` | anyone | no | L:739; Host:4398-4401 |
| Account tab | See every invoice and payment in date order with totals; open Accounts Receivable | `Invoices and payments`; `Billed` / `Paid` / `Written down` / `Balance`; `Accounts Receivable ↗` | anyone | no | L:747-754 |
| Account tab | See the property record and whether it is lien-ready; open it to edit | `Property record`; pills `missing …` / `complete`; `Property record ↗` | anyone | no | L:755-758 |
| Paper tab | See each job's agreement and sworn-account basis | `Agreements`; pills `holds` / `needs …` | anyone | no | L:769-776 |
| Paper tab | Open a job's contract, or the Contract desk | `View` / `Contract…`; `Contract desk ↗` | anyone | no | L:769, 775 |
| Paper tab | See each job's lien timeline; open its lien instruments | `Where each job stands`; the job label as a button; `Lien instruments ↗` | anyone | no | L:777-789 |
| Paper tab | Switch the timeline between steps and windows | `Steps` / `Windows` | anyone | no (remembered on the device) | T:246, 360-376 |
| Paper tab | Fan a folded timeline node open to see its months | `show the months ›` / `hide the months` | anyone | no | T:219-231 |
| Paper tab | See demand letters and open one | `Final demand letters`; pills `drafted, not sent` / `passed` / `open`; `Open` | anyone | no | L:790-797 |
| Paper tab | See every paper that went out, one row per envelope, and open its saved copy | `The paper that went out`; link `open ›` | anyone | no (external link) | L:798-803 |
| Paper tab | See the owner's answers, letter two and the GC's okay under a notice | band `The owner's answers` · `Letter two` · `GC's written okay to pay Click direct:` | anyone | no | L:130-139, 801 |
| Their word tab | Read everything said, oldest first, with kept and broken promise counts | `What was said · keeps N of M · N broken` | anyone | no | L:814-822 |
| Their word tab | Decide per entry whether the firm may read it; held entries show struck through | checkbox under `To counsel`: `goes` / `held` | office (others see pills) | yes: rpc `legal_matter_save_review` with held overrides; creates the matter if none | L:308-311, 826-830 |
| Their word tab | Clear every override; entries before the first bill are held again | `Only after the first bill ↗` | office | yes: same rpc | L:312-317, 815 |
| Their word tab | Share every entry | `Share all ↗` | office | yes: same rpc | L:815 |
| Their word tab | Open the customer's notes | `Customer notes ↗` | anyone | no | L:816 |
| Their word tab | Record a promise, or open call mode | `They said… ↗` (first job); `Call mode ↗` | anyone | no (those windows write) | L:816 |
| Evidence tab | See the proof per job: reports, sessions, GPS, hours, work dates, notes | `Proof the work happened` | anyone | no | L:839-853 |
| Evidence tab | Open the job's photos or Drive folder | `Photos ↗` / `Drive ↗` | anyone | no (external) | L:847-851 |
| Evidence tab | Open the first job's reports, session notes or thread | `Reports ↗` · `Sessions ↗` · `Job thread ↗` | anyone | no | L:839 |
| Fees & steps tab | See the firm's fees and costs with a total | `Attorney fees and costs · $X` | anyone | no | L:865-870 |
| Fees & steps tab | Open a write-down for the first job | `Write down ↗` | anyone (the button shows without the office gate) | no until applied | L:865 |
| Fees & steps tab | See what is on the matter and how many items wait on the office | `On the matter · N from the firm waiting on you`; pills `waiting on the office` / `seen` | anyone | no | L:873-905 |
| Fees & steps tab | Answer the firm's question inline | `Answer…` → input `Your answer` + `Send` / `Cancel` | office | yes: rpc `legal_add_entry` (answer) then `legal_acknowledge_entry`; the firm sees it on the portal | L:351-360, 885-893 |
| Fees & steps tab | Acknowledge a fee, cost or step | `Acknowledge` | office | yes: rpc `legal_acknowledge_entry` | L:348-350, 900 |
| Fees & steps tab | Go and apply a payment the firm received; closes the desk | `Mark Paid on the row ↗` | office | no | L:576, 896 |
| Fees & steps tab | Record that the payment was applied, with the firm's cut | `Mark applied` | office | yes: `legal_add_entry` ×2 (recovery_applied, contingency cost) then acknowledge | L:377-391, 897 |
| Fees & steps tab | Ask the firm a question, or for a sign-off on one job | `Ask the firm…` → select `A question` / `Sign off on a job`, job select, text input, `Send to the firm` / `Cancel` | office, matter with the firm | yes: `legal_add_entry` (question, flavor in meta); shared with the firm | L:361-371, 908-928 |
| Fees & steps tab | Withdraw an ask still open; see each ask's state | `Withdraw`; state pill | office | yes: `legal_acknowledge_entry` | L:372-375, 878-882 |
| Fees & steps tab | See what the office did in order, and the exhibits; open the first job's activity | `What we did, in order`; `Exhibits the packet would carry`; `Activity ↗` | anyone | no | L:930-937 |
| Mark-ready sheet | See exactly what goes and the warnings | `Mark {name} attorney-ready?`; `This is the release…`; `N entries are held back`; `Click keeps $X…`; `N red gaps still open — … You can mark anyway` | dev | no | L:586-599 |
| Mark-ready sheet | Preview the firm's own page for this account before release | `Preview what the firm sees ↗` | dev | no | L:601 |
| Preview | Walk the firm's five tabs, print the packet, close | tabs as above; `⎙ Print packet`; `Close preview`; a click outside | dev | no | L:619-642; F:185-196 |
| Mark-ready sheet | Name the handling person at the firm | `Handling person at the firm` | dev | on confirm | L:604 |
| Mark-ready sheet | See who at the firm hears and how; jump to the email list | pills `Email now` / `In their digest` / `Not confirmed` / `Not emailed`; `Firm's emails ↗`; paused warning | dev | no | L:605-607 |
| Mark-ready sheet | Add a note for the firm | `Note for the firm (optional)` | dev | on confirm | L:608 |
| Mark-ready sheet | Confirm the release, or cancel | `Mark attorney ready` / `Mark ready anyway`; `Cancel`; a click outside closes the sheet only | dev | yes: rpc `legal_mark_attorney_ready`; shared with the firm on its portal | L:318-327, 587, 611-614 |
| Ask-a-dev sheet | Ask with a note; the account goes to the top of the dev's Needs You card | `Ask a dev to review {name}`; textarea; `Ask` / `Cancel` | office | yes: `legal_matter_save_review` (request on, note) | L:328-335, 644-656 |
| Pull-back sheet | Pull the account back with an optional reason; the firm stops seeing it | `Pull {name} back from {firm}?`; `Why (optional)`; `Pull back` / `Cancel` | dev | yes: rpc `legal_pull_back` | L:340-347, 658-670 |
| Firm's emails | See each person at the firm: how they hear, their scope and status | `✉ Who at {firm} hears from us`; columns `Person, Hears, Scope, Status`; pills `stopped` / `confirmed` / `not confirmed` | office | no | L:672-692 |
| Firm's emails | Remove a person from the list | `Remove` | office | yes: rpc `legal_firm_recipient_remove` | L:421, 687 |
| Firm's emails | Pause or resume every email to the firm; close | `Pause all emails to the firm` / `Resume emails to the firm`; `Close` | office | yes: rpc `legal_firm_set_paused` | L:420, 694-697 |
| Firm's link | Create the firm's private link; never created just by opening | `No link yet.` / `The portal is off.` + `Create the firm's link` | office | yes: rpc `mint_legal_portal_link` | K:47-61, 98-102 |
| Firm's link | See the link and since when it has been active | the URL `…/legal?t=…`; `active since {date}` | office | no | K:78, 106-107 |
| Firm's link | Copy the link to send it | `Copy link` | office | no (clipboard) | K:79-87, 109 |
| Firm's link | Open what the firm sees without counting as a visit | `Preview ↗` | office | no (new tab) | K:110 |
| Firm's link | Replace the link; the old one stops working | `Rotate` | office | yes: rpc `mint_legal_portal_link` (rotate) | K:112 |
| Firm's link | Turn the portal off, after a confirm; close | `Turn off` → `Turn the firm's portal off?` / `Turn off`; `Close` | office | yes: rpc `revoke_legal_portal_link` | K:62-77, 113, 117 |
| Write-down | Enter an amount off, or a new total; each locks the other | `Apply discount`; `Discount (amount off, USD)` + `Max`; `New invoice total (USD)`; shows `Current billed` and `Payments on this invoice` | office | no until applied | A:227-331 |
| Write-down | Type the required internal note and apply, or cancel | `Note (internal)` (3 characters or more); `Apply discount` / `Applying…`; `Cancel` | office | yes: rpc `apply_agreed_write_down_to_billed_invoice`, or edge function `stripe-invoice-agreed-write-down` (a Stripe credit note) when the bill is on Stripe | A:93-193, 332-389 |
| Write-down | Have the matter closed as written down afterwards and the board reloaded | automatic | — | yes: `legal_matter_save_review` (creates the matter if none) then `legal_close_matter` stage `written_down` | L:393-412 |

### Easy to miss

- **Only a dev releases.** `canMarkReady` is `authRole === 'dev'` (Host:4408). A master technician is office here and sees Ask a dev, not Mark attorney ready.
- **The release can go with red gaps open.** The button becomes `Mark ready anyway` (L:613).
- **The firm preview exists only inside the Mark-ready sheet** (L:619), and that sheet draws only once the packet has loaded (L:586).
- **Ticking a To counsel box creates the matter** if the account had none (L:298-311). Entries before the first bill are held by default (L:820).
- **Write down… from the header uses the first job's primary bill line** (L:247-263). The guide says "largest open bill line". With no billed line it only shows a toast.
- The Write down door on Fees & steps shows even when the header button is hidden; it is not behind `canEditReview` (L:865 against L:444).
- **Two doors close the desk:** `Pipeline row ↗` and `Mark Paid on the row ↗` (Host:4398-4401). All other doors open over the desk.
- The desk refreshes its packet after Edit customer saves (L:251). Edit job reloads the board's jobs (Host:4392).
- Picking an account resets the tab to Account (L:478). `&legalTab=fees` opens on Fees & steps (L:227).
- Opening the desk fetches the Collections rows itself (Host:793-799).
- With the legal tables unavailable, the desk is read-only: no checkboxes, no office acts (L:423, 575-576).
- `Ask the firm…` shows only when the matter is with the firm (L:576).
- Pausing the firm's emails queues events; they send on resume (L:695). The matter still shows on the portal.
- The header says `Settings → Jobs & dispatch` (L:456). The sheet says `Settings → Jobs & billing` (L:591). The guides say Jobs & billing.
- There is no Esc handler in these files. Each sheet's backdrop click closes that sheet only (L:584-587).
- Outside the desk but part of the same flow: the Dashboard cards that link in (`DashboardPinnedQuickRow.tsx:793-795`), the Pipeline row's ⚖ chip, the firm's page `src/pages/LegalPortal.tsx` (Matters, Notifications and the lien grid), and Settings → Collections law firm. The portal's acts are the firm's, not the office's, so they are not in this table.
- The "Put a GC on notice" Legal tick writes the same `legal_matter_save_review` rpc (M:520-528), so that window can create or extend a matter this desk then shows.
