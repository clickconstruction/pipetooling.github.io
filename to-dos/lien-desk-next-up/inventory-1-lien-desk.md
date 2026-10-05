# 1 · The Lien desk

201 rows: every distinct action or relied-on view found in the Lien desk shell and its 20 part files (plus `LienNoticeByHandPane`, `LienTimelineStrip`, `PropertyKindSwitch` and the preview window, which the desk mounts).

| Area (tab / pane / dialog) | What the user can do (plain words, one line) | Control as labelled on screen | Who can do it | Writes data? | file:line |
|---|---|---|---|---|---|
| Shell · title bar | Close the desk | "×" (aria "Close"); a click on the dark backdrop also closes | office | no | LienDeskModal.tsx:1986, 1969 |
| Shell · title bar | Make the desk fill the screen, or go back to a window | icon button, tooltip "Full screen" / "Back to a window" | office, desktop only | no (browser localStorage) | LienDeskModal.tsx:259, 1985; ModalFullScreenToggle.tsx:37-49 |
| Shell · title bar | Read a one-paragraph summary of the whole flow on hover | "⏱ Lien desk" (title tooltip) | office | no | LienDeskModal.tsx:1978-1984 |
| Shell · title bar | Switch between the five tabs, each with its open count | "Calendar" · "Notices · {n}" · "Affidavits · {n}" · "Retainage · {n}" · "Timeline · {n}" | office | no | LienDeskModal.tsx:1988-1993 |
| Shell · title bar | Open the Texas lien rules guide in a new tab, at the row for the tab on screen | "§ Rules" | office | no | LienDeskModal.tsx:1995; LienRulesDoor.tsx:13-36 |
| Shell · title bar | Open the Share panel | "Share" (icon only on a phone or narrow desk) | office; disabled until data loads | no | LienDeskModal.tsx:1999-2024 |
| Shell · second line (Notices) | Filter the notice list to one pile; press again to clear. Missed is also a lens: it shows To draft jobs with a closed month | pills `{label} · {n}`: "Needs the owner", "To draft", "Awaiting approval", "Ready to send", "In the mail · tracking owed", "Held", "Sent · 30d", "Missed" (a zero pile is hidden unless picked) | office | no | LienDeskModal.tsx:2052-2061, 394-399 |
| Shell · second line (Affidavits) | Filter the affidavit list to one pile | "Needs the property facts", "To draft", "Awaiting approval", "Ready to file", "Held", "Filed · 30d", "Missed" | office | no | LienDeskModal.tsx:2040-2051 |
| Shell · second line (Retainage) | Filter the retainage list to one pile | "Clock not started", "Needs the owner", "To draft", "Awaiting approval", "Ready to send", "Held", "Sent · 30d", "Missed" | office | no | LienDeskModal.tsx:2028-2039 |
| Shell · second line (Notices) | Open the picker of GCs with notices due | "⚠ Put a GC on notice…" | office-gate; Notices tab only; only when a GC is listed | no | LienDeskModal.tsx:2062-2066 |
| GC picker menu | Pick a GC to open Put a GC on notice on it; each row shows dollars, jobs, first window to close and what is stuck; dead GCs sit under a heading | row `{GC}` `{$}` `{n} jobs` + chips ("needs the owner", "awaiting approval", "{n} missed", "rule: send"); heading "Nothing left to claim" | office-gate | no (hands off to the GC notice window) | LienDeskModal.tsx:2067-2105 |
| Shell · second line | Open the run of every approved notice | "Send the run · {n}" | office-gate; every tab except Affidavits; only when something is Ready | no | LienDeskModal.tsx:2108-2112 |
| Shell · second line | See which notices the office sent on the leader's spoken word | "Sent on your word: {job numbers}" | leader | no | LienDeskModal.tsx:839, 2113-2117 |
| Notices · list | Pick a job; the pane opens on it (on a phone the list gives way to the pane) | row button | office | no | LienDeskModal.tsx:892-898 |
| Notices · list | Read each row: urgency dot, job, GC, open balance, deadline chip, closed-window chip, months named, state words, letter-two chip, supply-house mark | e.g. "due in {n}d", "{months} window closed · not noted", "awaiting approval · {date}", "sent {date} · tracking owed", "letter two · {kind}" | office | no | LienDeskModal.tsx:865-928, 184-191 |
| Notices · list | Clear the narrowing the Calendar's Draft button put on the list | chip "{N} jobs from the calendar · by {date}" + "show every job" | office | no | LienDeskModal.tsx:848-857 |
| Notices · pane (phone) | Go back from the pane to the list | "← Back to the list" | office | no | LienDeskModal.tsx:1064-1068 |
| Notices · list | Read why the list is empty | "Looking at every unpaid sub job…" / "Nothing in this pile." / "Nothing is due — every unpaid month on a sub job is noticed, or is more than 30 days from its deadline." | office | no | LienDeskModal.tsx:843-847 |
| Notices · pane heading | Open the job itself (history, bills, Edit) over the desk | job-number chip (tooltip "Open the job: its history, its bills and Edit") | office | no | LienDeskModal.tsx:1070; LienJobNumber.tsx:13-46 |
| Notices · pane heading | See that this draft is a second owner letter | "letter two · {kind} · after the {date} packet" | office | no | LienDeskModal.tsx:1071-1075 |
| Notices · pane | Keep the facts in sight while scrolling the paper, and jump back to the gates | pinned strip (verdict, open gates, months, next step, "Claim {$}", wording line) + "Show gates ▴" | office | no | LienDeskModal.tsx:1036-1063 |
| Notices · timeline box | Read every Chapter 53 step on the job with its date, "Next on the path" and "Waiting on" | timeline strip | office | no | LienDeskModal.tsx:1006-1022, 1080-1084; LienTimelineStrip.tsx:247-262 |
| Notices · timeline box | Switch the picture between steps and first-day-to-last-day bars; the Months grid follows | "Steps" / "Windows" | office | no (localStorage `lienTimelineView`) | LienTimelineStrip.tsx:360-380 |
| Notices · timeline box | Fan out a stack of folded missed months | "show the months ›" / "hide the months" | office | no | LienTimelineStrip.tsx:221-232 |
| Notices · timeline box | Go to Edit Job to date a step the app cannot date | "set the date ›" | office | no here (Edit Job saves) | LienTimelineStrip.tsx:292-295, 337-342; LienDeskModal.tsx:1082 |
| Notices · leader card | See what the decision rests on: hand-set claim, wording changes, total open with the GC, their promise, months and hours, cost of a hold | "What you're deciding" | leader, Awaiting pile only | no | LienDeskModal.tsx:1086-1121 |
| Notices · gates | Read the verdict and four gates; press a gate to bring its section up and ring it for 4 seconds | "✓ Ready to go out" / "✗ Can't go out yet"; cells `{n}` "Owner of record" / "Original contractor" / "Property kind" / gate 4 (months) | office | no | LienDeskGates.tsx:46-91; LienDeskModal.tsx:301-307, 974-986 |
| Gate 1 · owner on file | Check the owner on the county appraisal site | "Check on {county} CAD ↗" | office | no | LienDeskModal.tsx:1155-1159 |
| Gate 1 · owner on file | Open Edit Job (Property record) to change the owner | "Change ›" | office | no here | LienDeskModal.tsx:1160-1167 |
| Gate 1 · no owner | See the appraisal roll's answer laid out as the envelope will read, with where it was found | automatic lookup; "Found at: {district · year}" | office | no | LienDeskOwnerPane.tsx:66-85, 185-201 |
| Gate 1 · no owner | Save the roll's owner on the property record and link the job | "Use this owner" | office | yes: customer_addresses owner fields; jobs_ledger.customer_address_id | LienDeskOwnerPane.tsx:151-168, 203-205 |
| Gate 1 · no owner | Open Edit Job to find or paste the owner by hand | "Find the owner ›" | office | no here | LienDeskOwnerPane.tsx:87-91 |
| Gate 1 · no owner | Open the parcel on the county site | "Check this parcel on {county} CAD ↗" / "{county} CAD ↗" | office | no | LienDeskOwnerPane.tsx:190-194 |
| Gate 1 | Read warnings about the owner: reads-as chips, mail goes elsewhere, public owner (bond claim, never drafted) | chips; "✉ Mail goes somewhere other than the house — …"; public-owner sentence | office | no | LienDeskOwnerPane.tsx:116, 209-225 |
| Gate 1 · unconfirmed roll owner | Check the nightly-saved owner on the county site and stamp it confirmed | "Owner from the roll ({year}) · unconfirmed · confirm on {county} CAD ↗" + "Confirm" | office | yes: customer_addresses.owner_confirmed_at / _by | LienDeskOwnerPane.tsx:101-134 |
| Gate 2 | Open Edit Job to set or change the GC; see the GC's name and mailing address | "Set the GC ›" / "Change the GC ›" | office | no here | LienDeskModal.tsx:1191-1214 |
| Gate 3 | Set the property's kind in place; see which other jobs share the property | "Residential" / "Commercial" switch; "Saved on the property record — {jobs}, which follows it" | office (no client role check) | yes: customer_addresses property kind | LienDeskModal.tsx:458-470, 1215-1240; PropertyKindSwitch.tsx:26-53 |
| Gate 3 · no linked property | Open Edit Job on the Property record row | "Set property kind ›" | office | no here | LienDeskModal.tsx:1221-1227 |
| Gate 4 | See each work month's hours and crew, pending sessions not counted, and jump to the months grid | "Months and deadlines ↓"; "{n} sessions awaiting approval not counted in the hours." | office | no | LienDeskModal.tsx:1242-1276 |
| Notices · supply houses card | See each supply house on the job: account, unpaid since, its own notice date, paid, owed, the verdict line; the same mark shows on list rows | "Supply houses on this job"; storefront mark on rows | office | no | LienJobSuppliers.tsx:29-38, 147-349; LienDeskModal.tsx:1282-1284 |
| Notices · supply houses card | Fold or unfold the card when every house is paid | "Show" / "Fold" | office | no | LienJobSuppliers.tsx:217-223 |
| Notices · supply houses card | Record what a house told us: its balance, its notice day, who said it, a note | "They told us…" / "Change what they told us…" → "Their balance on this job", "Their notice goes out", "Who said it", "Note", "Save", "Cancel" | office-gate | yes: job_supply_house_words upsert | LienJobSuppliers.tsx:61-134, 191-211 |
| Notices · supply houses card | Take the house's word off so the estimate returns | "Clear" | office-gate | yes: deletes the job_supply_house_words row | LienJobSuppliers.tsx:83-95, 120-124 |
| Notices · supply houses card | Copy a ready paragraph about the houses for an email | "Copy for an email" | office | no (clipboard) | LienJobSuppliers.tsx:179-189, 338-342 |
| Notices · supply houses card | Go to Materials, Held for suppliers, on this job | "Open in Held for suppliers ›" | office | no (leaves the page) | LienJobSuppliers.tsx:177, 343-345 |
| Notices · carried-correction strip | Confirm a carried claim correction still holds for this notice | "Still true" | office-gate | yes: job_lien_claim_corrections (looked-at stamp) | LienDeskModal.tsx:1287-1296 |
| Notices · carried-correction strip | Remove the carried correction | "Clear it" | office-gate | yes: clears job_lien_claim_corrections | LienDeskModal.tsx:1297-1299 |
| Notices · months grid | Read every month worked, its window, and each earlier paper (A, B…) that named it | "Months on this job"; chips "mail by {date}", "closed {date}", "not noted", "skipped", "✓ as information" | office | no | LienDeskMonths.tsx:60-100, 134-196; LienDeskModal.tsx:958-972 |
| Notices · months grid | Tick or untick the months this notice names | checkbox per month in the "This notice" column | office; locked once noticed, closed or past draft | not until the draft is saved or sent | LienDeskMonths.tsx:183-190; LienDeskModal.tsx:1337-1342 |
| Notices · months grid | Write down that a closed window was seen (not a skip) | "Note it as missed" | office-gate | yes: inserts a `missed` job_lien_desk_items row with name | LienDeskMonths.tsx:89-96; LienDeskModal.tsx:673-676, 1334 |
| Notices · months grid | Open the saved copy of an earlier paper | link `{saved-copy words} ›` in the paper's column header | office | no | LienDeskMonths.tsx:151 |
| Notices · months grid | Start recording a paper that went out by hand | "A paper that went out by hand? Record it…" | office-gate | no (opens the by-hand step) | LienDeskMonths.tsx:210; LienDeskModal.tsx:1335 |
| Notices · claim box | See the amount the notice claims and whether it was set by hand, by whom and why | "Claim amount on the notice"; chip "set by hand" | office | no | LienClaimBox.tsx:64-95 |
| Notices · claim box | Set the claim by hand with a required reason, and choose whether it carries forward | "Correct the claim ›" / "Change ›" → "$" amount, "Why · required", "Carry this to later notices and the affidavit until I clear it", "Cancel", "Apply" / "Apply — the leader decides" | office-gate | yes: job_lien_claim_corrections | LienClaimBox.tsx:98-172; LienDeskModal.tsx:1309-1316 |
| Notices · claim box | Give a month its own figure | "Say it per month ›" / "One figure ›" + one box per month | office-gate | yes, with Apply | LienClaimBox.tsx:137-154 |
| Notices · claim box | Undo the hand-set claim | "Back to the job’s figure" | office-gate | yes: clears the correction | LienClaimBox.tsx:80; LienDeskModal.tsx:1317 |
| Notices · claim box | See retainage named inside the claim, and open Edit Job (Our contract) to set or change it | "Includes {$} unpaid retainage {GC} holds — named on the form." "Change ›" / "Retainage {GC} holds: not recorded." "Set on the job ›" | door: office-gate | no here | LienDeskModal.tsx:1320-1333 |
| Notices · envelope line | See who the paper goes to and how | "✉ To {owner} and {GC} by certified mail · courtesy PDF to {email}" | office | no | LienDeskModal.tsx:1346-1349 |
| Notices · envelope line | Add or drop counsel's cover letter as page 1 of the owner's copy | "Include counsel's cover letter" | office; disabled once past draft | saved with the draft (cover_note) | LienDeskModal.tsx:1350-1353 |
| Notices · paper | Read the envelope page by page: cover letter, the notice, the pay-codes page | "Page {n} of {N} · cover letter" / "· the notice" / "· pay codes" | office | no | LienDeskModal.tsx:626-660, 1372-1422 |
| Notices · paper | Change one of four typed values in place (labor type, project description, party contracted with, contact person) | click a shaded box; Enter keeps, Esc cancels, clicking away keeps | office-gate, draft only | not until Save draft (then stamped with who and when) | LienDeskModal.tsx:575-624, 662-671, 1386-1408 |
| Notices · paper | Put a changed value back | "Back to the job’s wording" | office-gate, draft only | no | LienDeskModal.tsx:587-591 |
| Notices · paper | Click the original contractor to open Edit Job on the GC row | value with hover "Filled from the job · the GC — click to change it there" | office | no here | LienDeskModal.tsx:551-558, 601 |
| Notices · paper | Click the claimant's name or address to go to Settings → Company | hover "Filled from Settings → Company — click to change it there" | office | no here (leaves the page) | LienDeskModal.tsx:602; JobsStagesTab.tsx:4532 |
| Notices · paper | Click the claim amount to scroll to the claim box and open its editor | hover "Set on the claim box above — click, and it opens there" | office (editor opens for office-gate) | no | LienDeskModal.tsx:603-606; LienClaimBox.tsx:59-62 |
| Notices · paper | Hover any filled value to see where it comes from; a value changed at its source is ringed on return | titles "Filled from {source}"; "The day it is drafted or sent — nothing to change" | office | no | LienDeskModal.tsx:544-572 |
| Notices · paper | Learn why the wording will not change once sent for approval | toast and legend "Sent for approval — pull it back to a draft to change the wording." | office | no | LienDeskModal.tsx:609-611, 1357-1364 |
| Notices · paper | Open the notice as the packet prints it in its own browser tab | "Preview in a new window ↗" | office | no | LienDeskModal.tsx:774-783, 1366-1368 |
| Preview window | Type the four values there (the desk follows live), jump to a field on the desk, or reset a value | boxes in the side list; "Change ›" / "Add ›"; "Back to the job's wording" | office-gate, draft only | not until saved | lib/jobs/lienNoticePreview.ts:152-167; LienDeskModal.tsx:786-825 |
| Preview window | Save the draft from the preview | "Save draft" | office-gate, draft only | yes: saves the desk item | lib/jobs/lienNoticePreview.ts:224; LienDeskModal.tsx:799-806 |
| Preview window | Print the marked-up preview | "Print this preview" | office | no | lib/jobs/lienNoticePreview.ts:217 |
| Notices · standing rule box | Set the GC's default for every future month; saves the moment a radio is picked | "Standing rule for {GC}": "Ask me each time" / "Send notices without asking" / "Hold — I'll call first" | leader; Awaiting, Held or To draft piles | yes: RPC set_customer_lien_notice_policy | LienDeskModal.tsx:754-755, 1424-1437 |
| Notices · draft footer | Read what happens next and why | "→ Goes to the leader · {why}" / "Straight into the run" / "Parks under the hold rule" / "Approving puts it in the run" / "✗ {gate} missing" | office | no | LienDeskModal.tsx:1647-1686, 1714-1718 |
| Notices · draft footer | Save the draft without sending it | "Save draft" | office-gate | yes: job_lien_desk_items insert or update (drafted) | LienDeskModal.tsx:712-717, 1731 |
| Notices · draft footer | Send it on: to the leader, straight into the run under a live send rule, or parked under a hold rule | "Send for approval ▸" / "Put it in the run ▸" | office-gate (non-leader) | yes: status awaiting_approval, approved (rule) or held (rule) | LienDeskModal.tsx:718-731, 1745-1748 |
| Notices · draft footer | Approve straight from the draft | "Approve ▸" | leader | yes: saves the draft and approves it | LienDeskModal.tsx:1741-1744 |
| Notices · draft footer | When blocked, jump to the gate that blocks | "Go to gate {n} ▴" / "Show what is missing ▴" | office | no | LienDeskModal.tsx:1737-1740 |
| Notices · draft footer | Send on the leader's spoken word: who said it, when, how; the line below says what the record will read or why it is refused | "The leader said to send it…" → "Who said it, when, and how:" + "by phone" / "in person" / "by text" / "he is standing over me" / "he is typing it in" + "Record it and send ▸" + "Cancel" | word | yes: approved, approval_mode word, word_note, word_channel | LienDeskModal.tsx:732-740, 1698-1712, 1732-1736; LienWordRecordRow.tsx:31-71 |
| Notices · draft footer | Give up the lien right on the ticked months on purpose, with a required reason | "Skip {months}…" → "why (kept on the record)" + "Skip these months" + "Cancel" | office-gate | yes: item set to missed with reason and name | LienDeskModal.tsx:741-749, 1691-1697, 1722-1724 |
| Notices · draft footer | Open the step that records a notice already mailed by hand | "Already mailed? Record it…" | office-gate | no (opens the step) | LienDeskModal.tsx:1725-1727 |
| By-hand step | Record a notice mailed outside the run: when, how, tracking, to whom, the claim and months as printed, where the copy lives; see problems and the claim difference | "Sent on", method list (certified mail / mail / traceable courier / email / hand delivery), "Tracking", "owner of record", "original contractor", "As printed", "Saved copy", "Back", "Record it on {n} job(s) ▸" | office-gate (the door) | yes: one job_lien_filings row per job; live desk items marked sent | LienNoticeByHandPane.tsx:69-118, 195-243; LienDeskModal.tsx:1608-1634 |
| By-hand step | Tick other unpaid jobs at the same property that the one paper covered | "Also on this paper — other unpaid jobs at this property" | office-gate | yes, with Record | LienNoticeByHandPane.tsx:82-100, 218-234 |
| By-hand step (phone) | Same step as a full sheet over the desk | "Notice already sent" sheet; "Back"; "×" (closes the whole desk) | office-gate | same | LienNoticeByHandPane.tsx:123-191; LienRecordSheet.tsx:35-62 |
| Notices · awaiting footer (leader) | Hold the notice on a promise or a call, after seeing the re-ask date and the cost | "Hold — they promised…" / "Hold — I'll call first" → "Holds until {date}, then asks again." + "Hold" / "Cancel" | leader | yes: held, hold_reason, hold_until | LienDeskModal.tsx:751-752, 1758-1775 |
| Notices · awaiting footer (leader) | Send it back to the office to fix | "Back to the office" | leader | yes: back to drafted (pull-back stamp) | LienDeskModal.tsx:753, 1776 |
| Notices · awaiting footer (leader) | Approve it | "Approve & next ▸" | leader | yes: approved (leader) | LienDeskModal.tsx:750, 1778 |
| Notices · awaiting footer (office) | Take it back to a draft | "Pull back to draft" | office-gate | yes: back to drafted | LienDeskModal.tsx:1805 |
| Notices · awaiting footer (office) | Record that the leader is beside you and approves it | "He is here — record it ▸" → row "He is here — who, when, and how:" (preset "he is standing over me") + "Record it and send ▸" | word | yes: approved on his word | LienDeskModal.tsx:1782-1797, 1806-1817 |
| Notices · awaiting footer | See how long it has waited; record it as already mailed instead | "Waiting on the leader since {date}."; "Already mailed? Record it…" | door: leader or office-gate | no (opens the step) | LienDeskModal.tsx:1777, 1799-1804 |
| Notices · ready footer | See how it was approved; record it as already mailed instead of sending the run | "On the leader’s word · …" / "Approved by {GC}'s standing rule" / "Approved {date}" + "· in the run."; "Already mailed? Record it…" | door: office-gate | no | LienDeskModal.tsx:1821-1832 |
| Notices · ready footer | Pull back a notice the office sent on your word | "Not what I said" | leader, word-approved items | yes: back to drafted | LienDeskModal.tsx:1826-1828 |
| Notices · ready footer | Open the Lien window on its notice tab to print or email this one notice alone | "Just this one, from the Lien window ›" | office-gate | no here | LienDeskModal.tsx:1833-1835; JobsStagesTab.tsx:4533-4548 |
| Notices · ready footer | Open the run | "Send the run · {n} ▸" | office-gate | no | LienDeskModal.tsx:1836-1838 |
| Notices · held footer | Release the hold and approve | "Release the hold and approve ▸" | leader | yes: approved | LienDeskModal.tsx:1852 |
| Notices · held footer | Send a held notice back to a draft | "Back to draft" | office-gate | yes: back to drafted | LienDeskModal.tsx:1853 |
| Notices · held footer | See why it is held, when it re-asks and when the right ends; record it as already mailed | "Held — they promised · asks again {date}. {month}'s lien right ends {date}."; "Already mailed? Record it…" | door: office-gate | no | LienDeskModal.tsx:1842-1851 |
| Notices · sent footer | Read what has happened since the packet went out | "Sent {date}", "Day {n}", "GC paid: yes/no", "GC authorized direct pay: …", "Letter two: …", "Counsel: …", "Owner called: …" + "Pile {A/B/C}" | office | no | LienDeskModal.tsx:1895-1904 |
| Notices · sent footer | Add a tracking number that was owed; the shape is checked as typed; Enter saves | "tracking owed" + input + "add the number ›" | office (no client role check) | yes: job_lien_filings.sends | LienTrackingOwedEditor.tsx:31-78; LienDeskModal.tsx:1863-1864, 1900 |
| Notices · sent footer | Open the call sheet on this job | "Record the owner’s call…" / "The owner called again…" | office-gate | no (opens the sheet) | LienDeskModal.tsx:1926 |
| Notices · sent footer | Record the GC's written okay for the owner to pay us; turns letter two off | "The GC authorized direct pay…" → input + "Record it ▸" + "Cancel" | office-gate; hidden once authorized, paid or letter two sent | yes: fields on the first packet's desk item | LienDeskModal.tsx:1884-1892, 1905-1911, 1927 |
| Notices · sent footer | Start the second owner letter by picking its kind; it lands in To draft | "Send letter two ▸" → "Letter two · pick the letter": "We believe the owner paid the GC out" / "The GC is not answering" | office-gate; hidden when paid, sent or in flight | yes: a new drafted desk item | LienDeskModal.tsx:1870-1883, 1928-1947 |
| Notices · sent footer | Ask the law firm to sign off on taking the owner's direct payment | "Ask counsel to sign off…" → editable ask + "Send to the firm" + "Cancel" | office-gate; only when the job is with the firm, unpaid and not already asked | yes: RPC legal_add_entry (a question on the firm's matter) | LienDeskModal.tsx:1868-1869, 1912-1918, 1925; JobsStagesTab.tsx:4508-4521 |
| Notices · sent footer | Read what to do next about letter two | sentence, e.g. "Letter two goes 10–14 days after the packet…" / "Paid — nothing more to send." | office | no | LienDeskModal.tsx:1921-1923 |
| Notices · missed footer | Read that the window closed, and the skip reason if one was given | "The window closed on {months} with no notice — the lien right on that work is gone. Skipped: {reason}" | office | no | LienDeskModal.tsx:1952-1957 |
| Affidavits · list | Pick a job; each row shows deadline, counsel's pile, last work month, missing gates, supply-house mark | row; chips "file in {n}d", "{A/B/C} · {words}", "last work {month}", "· missing {gates}" | office | no | LienDeskModal.tsx:1444-1499; LienDeskAffidavitPane.tsx:56-62 |
| Affidavits · pane | Open the job itself from the heading | job-number chip | office | no | LienDeskAffidavitPane.tsx:307 |
| Affidavits · pane | Read the job's timeline (same Steps / Windows, fold and "set the date ›" controls) | timeline strip | office | no | LienDeskAffidavitPane.tsx:128-141, 310-312 |
| Affidavits · pane | See the § 53.052 gates, the claim and the window; open the door for a missing fact | "Before this affidavit can be generated…"; "Property record ›" (Edit Job); "Send the notice first ›" (switches to Notices on this job) | office | no here | LienDeskAffidavitPane.tsx:313-328 |
| Affidavits · pane | See the owner's call answers and counsel's pile; go record a call on the notice | "The owner's answers"; "Pile {A/B/C} · …"; "Record it on the notice ›" | office | no | LienDeskAffidavitPane.tsx:330-351 |
| Affidavits · pane | See the payment-bond line and open Edit Job (Our contract) to set it | "Payment bond: …"; "Check the project ›" / "Change ›" | office | no here | LienDeskAffidavitPane.tsx:352-355 |
| Affidavits · pane | See which months the lien covers and which are unsecured, and the sworn claim | "Months the affidavit claims"; chips "on the lien" / "window open" / "unsecured"; "Worked, not noticed" | office | no | LienDeskAffidavitPane.tsx:360-410 |
| Affidavits · pane | Read the affidavit as the Lien window will print it | paper | office | no | LienDeskAffidavitPane.tsx:152-179, 411-413 |
| Affidavits · footer (draft) | Send the affidavit for approval (or approved at once under a send rule) | "Send for approval ▸" | office-gate; off while a gate is open | yes: job_lien_desk_items kind affidavit | LienDeskAffidavitPane.tsx:195-205, 241 |
| Affidavits · footer (draft) | Approve from the draft | "Approve ▸" | leader | yes: approved | LienDeskAffidavitPane.tsx:207, 239 |
| Affidavits · footer (draft) | Record the leader's spoken word to file it | "The leader said to file it ▸" → word row + "Record it ▸" | word | yes: approved on his word | LienDeskAffidavitPane.tsx:206, 216-229, 237 |
| Affidavits · footer (awaiting, leader) | Hold, send back or approve | "Hold — they promised…" / "Hold — I'll call first" (+ "Hold" / "Cancel") / "Back to the office" / "Approve — file it ▸" | leader | yes | LienDeskAffidavitPane.tsx:208-209, 247-262 |
| Affidavits · footer (awaiting, office) | Take it back to a draft | "Pull back to draft" | office-gate | yes | LienDeskAffidavitPane.tsx:264-268 |
| Affidavits · footer (ready) | Open the Lien window's affidavit tab to print, file and record; the leader can undo a word approval | "Open the affidavit tab ›"; "Not what I said" | office-gate; leader | no here; pull-back writes | LienDeskAffidavitPane.tsx:270-279 |
| Affidavits · footer (held) | Release the hold and approve, or send back to draft | "Release the hold and approve ▸" / "Back to draft" | leader / office-gate | yes | LienDeskAffidavitPane.tsx:281-288 |
| Affidavits · footer (filed) | Open the Lien window to record service; hand an unpaid account to the Legal desk (closes the Lien desk) | "Record service ›"; "Refer to the Legal desk ›" | office | no here | LienDeskAffidavitPane.tsx:290-297; JobsStagesTab.tsx:4501-4504 |
| Affidavits · footer (missed) | Go to the Legal desk when the window closed unpaid | "The Legal desk ›" | office | no | LienDeskAffidavitPane.tsx:299-300 |
| Retainage · list | Pick a job; each row shows retainage held, deadline, how the contract ended, whether it is inside a monthly claim | row; "in the § 53.056 claim" / "not yet in a § 53.056 claim" | office | no | LienDeskModal.tsx:1532-1579 |
| Retainage · pane | Open the job itself; see the § 53.057 deadline chip and the bond chip | job-number chip; "§ 53.057 · {deadline words}" | office | no | LienDeskRetainagePane.tsx:265-270 |
| Retainage · pane | See the gates and the claimed retainage; open Edit Job for a missing or wrong fact | "Before this notice can go…"; "Property record ›"; "Set on the job ›" / "Change ›" | contract and retainage doors: office-gate | no here | LienDeskRetainagePane.tsx:271-291 |
| Retainage · pane | See whether a monthly notice already named this retainage, and jump to the job's monthly notices | "Already inside a § 53.056 claim" / "Not yet inside a § 53.056 claim"; "The monthly notices on this job ›" | office | no | LienDeskRetainagePane.tsx:292-304 |
| Retainage · pane | Read the two pages: counsel's retainage cover letter and the statute's form | "Page 1 of 2 · cover letter…" / "Page 2 of 2 · the form…" | office | no | LienDeskRetainagePane.tsx:305-312 |
| Retainage · footer (clock not started) | Open Edit Job (Our contract) to type the day the contract ended | "Set the day our contract ended ›" | office-gate | no here | LienDeskRetainagePane.tsx:168-175 |
| Retainage · footer (draft) | Send for approval, approve, or record the leader's word | "Send for approval ▸" / "Approve ▸" / "The leader said to send it ▸" → "Record it ▸" | office-gate / leader / word | yes: job_lien_desk_items kind retainage_53_057 | LienDeskRetainagePane.tsx:149-161, 176-207 |
| Retainage · footer (awaiting) | Leader holds, sends back or approves; office pulls back | "Hold — they promised…" / "Hold — I'll call first" / "Back to the office" / "Approve ▸"; "Pull back to draft" | leader; office-gate | yes | LienDeskRetainagePane.tsx:162-163, 208-231 |
| Retainage · footer (ready) | Open the run; the leader can undo a word approval | "Send the run ▸"; "Not what I said" | office-gate; leader | no; pull-back writes | LienDeskRetainagePane.tsx:232-240 |
| Retainage · footer (held) | Release the hold and approve, or back to draft | "Release the hold and approve ▸" / "Back to draft" | leader / office-gate | yes | LienDeskRetainagePane.tsx:241-249 |
| Retainage · footer (sent / missed) | Read what was sent or what the missed window means | "Sent {date} · the notice is on the job's lien instruments…" / "The § 53.057 window closed…" | office | no | LienDeskRetainagePane.tsx:250-258 |
| Timeline · toolbar | Narrow the book to one GC | select "GC": "All GCs · {n}" / "{GC} · {n}" | office | no | LienDeskTimelineTab.tsx:63-73 |
| Timeline · toolbar | Switch between jobs with something due and the whole book; read the count and open money | select "Show": "Something due · {n}" / "All · {n}"; "{n} jobs · {$} open · {n} more with nothing due yet · {n} gone" | office | no | LienDeskTimelineTab.tsx:74-83 |
| Timeline · toolbar | Print counsel's grid for the rows shown | "⎙ Print the grid" | office | no (opens a print window) | LienDeskTimelineTab.tsx:85-87; LienDeskModal.tsx:2152 |
| Timeline · rows | Open a job on the tab its next step belongs to; a job the desk does not list opens its Lien window | row click | office | no | LienDeskTimelineTab.tsx:97-104; LienDeskModal.tsx:989-1003 |
| Timeline · rows | Open the job itself | job-number chip | office | no | LienDeskTimelineTab.tsx:107 |
| Timeline · rows | Read each job's mini timeline, next step, "Waiting on" and the kind-unknown warning | "Waiting on {who} — …"; "commercial dates · a month earlier if residential" | office | no | LienDeskTimelineTab.tsx:105-128 |
| Calendar · toolbar | Show all jobs or one bucket; a second press goes back to All | pills "All" / "Overdue" / "This month" / "Next month" / "Later" with count and money | office | no | LienDeskCalendarTab.tsx:518-544, 782-795 |
| Calendar · toolbar | Search the board | box "Job #, name, customer, GC, address"; on a phone the "⌕" pill opens it | office | no | LienDeskCalendarTab.tsx:563-573, 823-840 |
| Calendar · toolbar | Show only jobs where a supply house is still owed | storefront pill with a count (aria "Show only jobs where a supply house is still owed · {n} jobs") | office | no | LienDeskCalendarTab.tsx:755-759, 796-814 |
| Calendar · toolbar | See how many properties have no kind; open the list to set them | "{n} kinds not set ›" | button for office-gate on desktop; plain words otherwise | no | LienDeskCalendarTab.tsx:547-560, 830 |
| Calendar · Set kinds sheet | Set each property's kind, biggest money first, and watch its lien date move | "Set kinds, biggest first": "Residential" / "Commercial" per row; "Set property kind ›" (Edit Job, no linked property); "Close" | office-gate, desktop | yes: customer_addresses property kind | LienDeskCalendarTab.tsx:377-425, 841 |
| Calendar · date row and marks | Read each 15th with how many jobs come due, today's line, and hover any mark for its meaning | "today · {date}"; count badges; hover titles on ticks, flags, dots and bars | office | no | LienDeskCalendarTab.tsx:171-190, 563-602 |
| Calendar · board | Fold or unfold a bucket; read its facts and money | bucket bar (▾ / ▸) | office | no | LienDeskCalendarTab.tsx:605-649, 775-781 |
| Calendar · board | Send a bucket's jobs to the Notices tab, To draft pile, narrowed to them | `{draft label} ›` on the bar (tooltip "Open the Notices tab on these jobs, ready to draft") | office | no | LienDeskCalendarTab.tsx:610, 622-627, 639-642; LienDeskModal.tsx:2134-2139 |
| Calendar · board | Fold or unfold a GC's jobs | GC row (▾ / ▸) | office | no | LienDeskCalendarTab.tsx:427-450 |
| Calendar · GC row | Record the GC's promised pay date for all its jobs at once | GC row dot → "They said…" → "Save for all {n}" | office-gate, desktop | yes: add_job_payment_promise RPC per job | LienDeskCalendarTab.tsx:254-267, 298-374 |
| Calendar · job row | Open the job's Lien window; the desk stays open under it | click the row or its name | office | no | LienDeskCalendarTab.tsx:469-485; LienDeskModal.tsx:2127 |
| Calendar · job row | Open the job itself | job-number chip | office | no | LienDeskCalendarTab.tsx:471 |
| Calendar · job row | Record or change when they said they would pay, with the consequence read back before saving | pay dot or dashed dot → "They said…": chips "Still {date}" / "This Fri · {date}" / "Next Fri · {date}" / "End of {Mon}", "Pay by", "Whose word", "Note", "Cancel", "Save" | office-gate, desktop; otherwise the dot opens the Lien window | yes: add_job_payment_promise RPC | LienDeskCalendarTab.tsx:225-230, 298-374 |
| Calendar · job row | Click an owed-notice flag to open the Lien window | amber flag button | office | no | LienDeskCalendarTab.tsx:231-240 |
| Calendar · key | Tap a mark to read what it means; two marks carry a door; Esc or × closes | "Key · tap a mark" + marks ("Today", "Last day worked", "Notice owed", "Lien deadline", "Kind not set", "Lien gone"…); "Set kinds, biggest first ›" / "Draft the notices ›" | office, desktop; kinds door office-gate | no | LienDeskCalendarTab.tsx:656-695, 926-937 |
| Calendar · phone | Same buckets as two-line sentences with no axis; tap a row for the Lien window, the number for the job | bucket sections | office | no | LienDeskCalendarTab.tsx:698-744 |
| Calendar · board | See an overdue job listed greyed under its property; read loading and empty messages | property heading; "Reading the board…" / "Nothing billed is on a lien clock." / "No billed job matches that." | office | no | LienDeskCalendarTab.tsx:452-459, 843-857 |
| ☎ Someone's calling | Open or close the caller's search box | "☎ Someone’s calling ›" | office-gate | no | LienCallerDoor.tsx:89-92; LienDeskModal.tsx:1996 |
| ☎ Someone's calling | Search every job on the three lists by number, street, owner or GC; matched words are marked; Esc or × closes | "Find" box "a job number, a street, an owner or a GC…" | office-gate | no | LienCallerDoor.tsx:52-58, 95-99 |
| ☎ Someone's calling | Press a sample word to see what a search looks like | "Try:" chips | office-gate | no | LienCallerDoor.tsx:103-112 |
| ☎ Someone's calling | See the letters out now, newest first, and open the call sheet on one | "Letters out now · {n}" rows + "Open the call sheet ›" | office-gate | no | LienCallerDoor.tsx:69-74, 113-118 |
| ☎ Someone's calling | From results, open the call sheet on a job with a letter sent (without selecting it on the desk) | "Letter sent · {n}" rows | office-gate | no | LienCallerDoor.tsx:138-144; LienDeskModal.tsx:362, 2179-2208 |
| ☎ Someone's calling | From results, open a job with nothing mailed on its own tab, lifting any pile or calendar filter | "No letter mailed yet · {n}" rows + "Open the job ›" | office-gate | no | LienCallerDoor.tsx:145-158; LienDeskModal.tsx:439-457 |
| ☎ Someone's calling | See a GC match with its job count, a forgiven typo, or that nothing matched | "GC · {name} · {n} jobs on the desk"; "Nothing has “{typed}” in it. Showing “{used}”."; "No job on the Lien desk matches…" | office-gate | no | LienCallerDoor.tsx:125-137 |
| ☎ Someone's calling | Take a practice call on a made-up letter | "▶ Practice call" | office-gate | no | LienCallerDoor.tsx:75-86; LienDeskModal.tsx:2209-2219 |
| ☎ Someone's calling | Open the help guide for the call in a new tab | "How this works ↗" | office-gate | no | LienCallerDoor.tsx:83 |
| Owner call sheet | See the letter the owner is holding and the last recorded call | "{owner} is holding … — {$} for {months} under {GC}, signed {name}."; "Last call: … A new call overwrites it." | office-gate | no | LienOwnerCallDialog.tsx:94-99 |
| Owner call sheet | Jump to an opening from anywhere in the call | chips "Paid my builder", "Still owe some", "Am I being sued?", "Builder’s gone quiet", "Can I pay you?", "Wants a call back" | office-gate | no | LienOwnerCallDialog.tsx:58-61, 101-106 |
| Owner call sheet | Read the line to say; hover ⓘ for the statute cites | "Say" card; "i" | office-gate | no | LienOwnerCallDialog.tsx:108-112 |
| Owner call sheet | Tap the owner's reply; some replies ask for an amount or dates first | reply buttons; "about $", "around {date}", "and {GC} wrapped up {date}", "still going", "Next ›" | office-gate | no until saved | LienOwnerCallDialog.tsx:43-57, 122-152 |
| Owner call sheet | Undo the last tap | "‹ Back" | office-gate | no | LienOwnerCallDialog.tsx:62-65, 169 |
| Owner call sheet | Watch the record build as one sentence, with counsel's pile | "So far" / "The call, in one sentence"; "Pile {A/B/C}" | office-gate | no | LienOwnerCallDialog.tsx:156-160 |
| Owner call sheet | Add a note on the last card; read what never to say | "Note"; "Never" strip | office-gate | no until saved | LienOwnerCallDialog.tsx:116-120, 161-166 |
| Owner call sheet | Save the call onto the sent notice | "Save the call" | office-gate | yes: ownerCall on the first packet's job_lien_desk_items.fields; overwrites the last call | LienOwnerCallDialog.tsx:66-67, 175; LienDeskModal.tsx:2205 |
| Owner call sheet | Leave without saving; a click outside closes the sheet only, not the desk | "Cancel"; "×" | office-gate | no | LienOwnerCallDialog.tsx:80, 85, 171 |
| Owner call sheet · practice | Run every card on a made-up letter with no Save | banner "Practice call · a made-up letter · nothing is saved"; "Start over ↺"; "Close"; "Done practicing" | office-gate | no | LienOwnerCallDialog.tsx:68-75, 87-92, 171-174 |
| Share panel | Choose what to send: the whole desk, one GC, or the jobs where a supply house is also owed | "What to send" menu; rows `{name}` `{$}` + "{n} jobs · first by {date} · {n} waiting for approval · {n} need the owner" | office | no | LienDeskSharePanel.tsx:15-74; LienDeskShare.tsx:62-66 |
| Share panel | Read the message exactly as it will go, with when the numbers were read | "The message"; "as of {time}" | office | no | LienDeskSharePanel.tsx:128, 137-142 |
| Share panel | Send it through the device's share sheet, or copy it where there is none | "Send…" / "Copy the text" | office | no | LienDeskSharePanel.tsx:145-148; LienDeskShare.tsx:112-120 |
| Share panel | Copy the message and link | "Copy" | office | no (clipboard) | LienDeskSharePanel.tsx:153-157; LienDeskShare.tsx:72-81, 121 |
| Share panel | Open the team email window | "Email a teammate…" | office | no | LienDeskSharePanel.tsx:149-152 |
| Share panel | Copy the law firm's live portal link | "Copy the firm’s link ›" | office; only when the firm has a link | no | LienDeskSharePanel.tsx:162-169; LienDeskShare.tsx:49-60, 124 |
| Share panel | Close the panel alone: ×, Esc or a click outside | "×" | office | no | LienDeskSharePanel.tsx:105-116, 124, 129 |
| Share · email window | Pick up to 5 teammates; the leader is marked and starts picked when notices await approval | "To" chips; "· approves" | office | no | LienDeskEmailSheet.tsx:60-80, 102-105, 150-175 |
| Share · email window | Edit the subject | "Subject" | office | no | LienDeskEmailSheet.tsx:93, 182-187 |
| Share · email window | Change what is sent (resets the subject) | "What to send" menu | office | no | LienDeskEmailSheet.tsx:190-194 |
| Share · email window | Add a short note on top | "A note on top · optional" | office | no | LienDeskEmailSheet.tsx:195-201 |
| Share · email window | See the email as it will arrive, inline or full size | "The email"; "Preview the whole email ›" | office | no | LienDeskEmailSheet.tsx:203-214, 236 |
| Share · email window | Send yourself a test | "Email me a test" | office | sends an email through the send-lien-desk-summary function; whether it stores anything was not checked | LienDeskEmailSheet.tsx:107-124, 227-229 |
| Share · email window | Send the email to the picked people; a toast names who it reached and who it did not | "Send to {name}" / "Send to {a} and {b}" / "Send to {n} people" | office | sends an email through send-lien-desk-summary | LienDeskEmailSheet.tsx:230-232; LienDeskShare.tsx:95-99 |
| Share · email window | Go back to the panel or close: "‹ Back", "×", Esc, a click outside | "‹ Back"; "×" | office | no | LienDeskEmailSheet.tsx:82-91, 132-142 |
| Run window | Read the envelopes, what is in each, the copies and the three steps | "Send the run · {n} notices"; "Envelope {n} · {label}"; "Copy for: …"; "1 · Print the packet" → "2 · Mail them" → "3 · Record the mailing" | office-gate (the doors) | no | LienDeskRunModal.tsx:193-227, 239-306 |
| Run window | Combine jobs at one property into one notice | "Combine the jobs at one property into one notice" | office-gate | changes what Record writes | LienDeskRunModal.tsx:61-64, 230-238 |
| Run window | Choose how each envelope goes | "Method": "certified mail, return receipt" / "traceable courier" / "email (courtesy — mail it too)" / "hand delivery" | office-gate | saved on Record | LienDeskRunModal.tsx:137-141, 262-268 |
| Run window | Type each envelope's tracking number; its shape is checked as typed | "Tracking #" (placeholder "9407 1118 …" or "who signed for it") | office-gate | saved on Record | LienDeskRunModal.tsx:269-286 |
| Run window | See which recipients are wrong; Record is refused until fixed | red lines per copy; "Fix the recipients marked in red before recording." | office-gate | no | LienDeskRunModal.tsx:131-132, 296, 324-326 |
| Run window | Print one page per envelope face | "Envelope faces" | office-gate | no | LienDeskRunModal.tsx:153-155, 318-320 |
| Run window | Print the whole packet in envelope order; the notices move to the mail pile | "Print the packet · {n} envelopes" | office-gate | yes: printed_at / printed_by on the desk items | LienDeskRunModal.tsx:143-152, 321-323; LienDeskModal.tsx:2222-2225 |
| Run window | Keep a link and note to the packet as printed | "Saved copy" link + note | office-gate | saved on every notice's record | LienDeskRunModal.tsx:309-313 |
| Run window | Set the day the envelopes went out | "Mailed on" | office-gate | saved on Record | LienDeskRunModal.tsx:314-317 |
| Run window | Record the mailing; envelopes without a number stay in the pile and the window stays open on them | "Record the run ▸" / "Record {n} mailed · {m} stay(s) in the pile ▸" | office-gate | yes: job_lien_filings per notice, desk items marked sent, courtesy emails via send-lien-filing-email | LienDeskRunModal.tsx:157-177, 327-329; lib/jobs/lienDeskRunIo.ts:34-87 |
| Run window | Close the run only (× or a click outside), not the desk | "×" | office-gate | no | LienDeskRunModal.tsx:185-190, 200 |
| Run window | Undo an approve-all click | "Undo the approval…" | never from the Lien desk: its mount passes no `undo`; only the copy opened from Put a GC on notice shows it | writes there, not here | LienDeskRunModal.tsx:202-210; LienDeskModal.tsx:2220-2233 |

Role key: `office` means the code shows no gate beyond opening the desk. `office-gate` is `isLienOffice` (dev, master_technician, assistant, controller). `leader` is `isLienLeader` (dev, master_technician). `word` is `canSendLienOnWord` (dev, assistant, controller, deliberately not the master). These are in `src/lib/jobs/lienDesk.ts:287-297`. File names without a path are in `src/components/jobs/`. I did not read the database policies; `docs/LIEN_DESK_ARCHITECTURE.md` (Hazards) says the server also refuses an approval from a non-leader and a word send without a note.

## Easy to miss

**State kept across opens**
- The desk stays mounted between opens, so the picked pile, the selected job on each of the three lists, the Timeline's GC and Show filters and the Calendar's "Draft" narrowing all survive a close (LienDeskModal.tsx:265-372, 827).
- The tab resets on every open: Calendar by default, Notices when a door names a job (LienDeskModal.tsx:339-343; JobsStagesTab.tsx:4482).
- A pile passed by a door is set, but never cleared on the next plain open (LienDeskModal.tsx:266-268).
- The Calendar tab's own state (picked pill, folds, search, houses lens) resets whenever you leave the tab; Overdue always starts folded (LienDeskCalendarTab.tsx:747-756).
- Two choices are remembered per browser: full screen and Steps / Windows.

**Links the desk honours**
- `/jobs?tab=stages&liendesk=1`, with optional `&liendeskJob=<id>`, `&liendeskPile=missed` and `&kind=affidavit|timeline` (`src/lib/jobs/stagesDeepLinks.ts:45-57`).
- No URL opens the Retainage or Calendar tab by name.
- The Dashboard and Quickfill navigate with `liendeskPile=sent`, but the parser only honours `missed`, so that link opens the desk with no pile picked (DashboardPinnedQuickRow.tsx:818; QuickfillNeedsYouSection.tsx:220).
- The shared message's link is the same deep link, with `liendeskJob` for the first job when one GC is picked (`supabase/functions/_shared/lienDeskStatus.ts:216-221`).

**Automatic selection and resets**
- Desktop selects the first visible row; a phone selects none; a job named by a door wins (LienDeskModal.tsx:402-417).
- Switching jobs clears month ticks, wording edits and the open skip, word, hold and by-hand rows, and sets the cover tick to the item's (LienDeskModal.tsx:482-496).
- It does not clear the skip reason, the word channel, an open GC-okay box, the counsel ask or the letter-two menu; these can survive a job switch.

**Rules with no button**
- The claim on the paper is always re-read live from the balance and any correction, over whatever the stored draft says (LienDeskModal.tsx:529-532).
- A hand-set claim over the balance, or a carried one nobody has looked at since the last notice, always goes to the leader whatever the rule; a spoken word is refused unless he is present (LienDeskModal.tsx:507, 725-727, 1709).
- A send rule waits for the second notice: the first notice to a GC goes to the leader (LienDeskModal.tsx:474, 1678-1679).
- The leader's "Approve ▸" on a draft saves and approves without the submit step (LienDeskModal.tsx:1742).
- Saving a draft stamps who edited the wording and when, keeps the batch reason and cover letter written by Put a GC on notice, and flags months dated from the job's creation (LienDeskModal.tsx:662-671).
- A new owner call overwrites the last one; a practice call writes nothing.

**Only in certain states**
- "In the mail · tracking owed" (printed) rows have no footer at all: the footer has no branch for that pile (LienDeskModal.tsx:1641-1958).
- The run lists Ready plus printed notices plus Ready retainage, but the header button and its count use Ready only, so with only printed notices left the header shows no way back into the run (LienDeskModal.tsx:2108-2111, 2226).
- The Timeline tab's count appears only after the tab has been visited once; the book is read then and kept (LienDeskModal.tsx:337-349, 1991).
- The Calendar pen (pay dots, Set kinds) is office-gate and desktop only; on a phone or for a read-only role the dot opens the Lien window instead (LienDeskCalendarTab.tsx:770).
- The Share email pre-picks the leader only when notices await approval.
- `LienDeskMonths` can show a "Preview ›" link and a tail line, but the desk passes neither, so they never appear here (LienDeskMonths.tsx:109-127, 161; LienDeskModal.tsx:1306-1343).

**Keyboard and windows**
- The desk has no Esc handler of its own. Esc closes the Share panel, the email window, the calendar key panel and the caller's box (while its input has focus), and cancels a paper edit.
- Enter keeps a paper edit and saves a tracking number.
- The Lien window, the Job window, Edit Job and Put a GC on notice open over the desk, which stays open under them. "Refer to the Legal desk ›" closes the desk. The claimant door navigates to Settings.
- The preview tab belongs to the job it was opened on, follows the desk live, and a blocked popup shows a toast (LienDeskModal.tsx:774-825).
- There is no live refresh: the desk re-reads only after its own writes, so a change made elsewhere is unseen until then.
- The owner lookup on the appraisal roll runs by itself for an ownerless job and is cached for the session (LienDeskOwnerPane.tsx:66-85).

**Guide and code disagree**
- The guide describes dots under "Earlier months" that open a month's record. I found no such control in the files read; the `LienDeskMonths` header comment says the grid replaced them. Worth confirming before the redesign drops or restores it (`src/content/help/send-lien-notices-from-the-lien-desk.md:127`).
- The guide says Record the run refuses an unconfirmed owner. That check is in `runNoticeProblems`, which I did not open.