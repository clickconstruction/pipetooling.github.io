---
name: "Lien screens: the app's own words that are stale"
number: 87
status: found 2026-10-05 by the lien-guide freshness pass (read against main's code, no live look); J, K and L added 2026-10-06; N added 2026-10-06 · shipped: E and F v2.4675, I v2.4659, J v2.4697, N v2.4698, M v2.4679 (waiting for a live look) · of the four held as the owner's decisions, C shipped v2.4661 and D v2.4674, A rides on the legal-portal train's #4637, and B shipped v2.4666 (the owner chose the tick on and the courtesy-copy wording)
summary: >
  Three open places on the lien screens (G, H and K) where the app's own words promise something the
  app does not do or name a rule it no longer follows. The help guides were patched to say what the app
  does today; these are the app's side, kept here so they are not lost. The owner answered all three on 2026-10-09: build G's list, keep H's tick and fix its guide, read a blank kind as residential everywhere (K).
  E, F, I, J and N shipped; L was built as option B (v2.4708); M is fixed and waits for a live look; A
  rides on the legal-portal train.
size: XS each
opinion: G, H and K are your call — K has a deadline in it, and the earlier date is the safe one.
mockup: not required — words and one focus on screens that exist
group: ready
next: G (the owner, 2026-10-09): build the list — Sent on your word also lists the notices a standing rule sent, marked as the rule's, so the hint and the guide's example come true. H (the owner, 2026-10-09): the office keeps the tick; the guide *read the Texas lien rules the app follows* stops saying the line waits on the attorney. K (the owner, 2026-10-09): a blank property kind reads residential — the earlier date — on every screen (the Lien window, the desk's gates and Timeline, the GC run, the timeline book, the Forecast panel), the "set the kind" warning kept; the guides follow. L was built as option B (v2.4708). A lands with #4637. M: confirm it on a waiting waiver live, then delete it.
blocker: None on G, H and K; M waits on a live look; A on #4637.
---

# Lien screens: the app's own words that are stale

## Where this came from

On 2026-10-05 the owner's coordinating session asked for every lien help guide to be read against main's code. Six read-only readers checked about 700 claims. Most findings were guide sentences gone stale, and those were patched in the guides. Items E to H went the other way: the guide matched what the screen says, and the screen is the one that is wrong. J and K came from the second read of the guide pass's fourth PR (v2.4623). The coordinating session asked that they be written here.

Four more of that kind (a fee the firm adds cannot be acknowledged, the courtesy PDF, *Cancel request* unlocking a release, *Issue unconditional* reselecting one bill) are with the owner as decisions. They are listed in the guide PRs as held sentences, not here. Item I below is here as well, because its fix is in the app's code.

This card was first numbered #85. The legal-portal train had already named its card #85 in its PRs, so this one moved to #87.

## Where each item stands (2026-10-06)

- **Shipped:** E and F (v2.4675), I (v2.4659), J (v2.4697), N (v2.4698), M (v2.4679, still to be seen live), H (v2.5030: the owner kept the tick on 2026-10-09, so only the words changed). Of the four
  decisions held in the guide PRs, the owner chose on 2026-10-06 to fix the app for all four:
  C (*Cancel request* unlocks a waiver its own request minted) shipped in v2.4661, D (*Issue
  unconditional* selects every covered bill) in v2.4674, and B (the GC's courtesy PDF from the run)
  in v2.4666. For B the owner chose the tick on by default and an email that says it is a courtesy
  copy.
- **In other hands:** A (a fee or cost the firm adds can be acknowledged) is built into the
  legal-portal train's #4637, which rewrites the Legal desk's fees table.
- **The owner's calls:** G, K and L (L also counsel's).

## The items

**E. *Find the owner ›* promises the Property record.** The Lien desk's owner pane button has the hover *Edit Job → Property record: link or add the property, then its owner of record*, but it opens Edit Job with no focus, so the Property record row stays closed.

- `src/components/jobs/LienDeskOwnerPane.tsx:88` calls `onOpenEditJob(jobId)` with no focus.
- `src/components/jobs/LienDeskModal.tsx` hands the pane the desk's own `onOpenEditJob`, and `src/components/jobs/JobsStagesTab.tsx:4552` maps a missing focus through `lienFocusEditJobOptions` (`src/lib/jobs/lienFocusEditJobOptions.ts`), whose default is `{}`.
- Gate 3's door on the same desk does pass `'property-record'` (`LienDeskModal.tsx:1306`).
- Fix: pass `'property-record'` from the pane, as gate 3 does. Then *send lien notices from the Lien desk* and *understand how liens work and which lien tool to use* can say again that the button opens Edit Job at the Property record.

**F. The nightly owner lookup's Settings line still says "with approved hours".** Settings → Jobs & billing reads *Every night, GC jobs with approved hours and no owner get the roll's answer saved as from the roll · unconfirmed.* Since v2.3747 the list it runs over also holds GC jobs with no approved hours, dated from their creation month.

- `src/components/settings/OwnerAutoConfirmSettingsBlock.tsx:48` is the sentence.
- `supabase/functions/owner-confirm-nightly/index.ts:147-149` reads `list_jobs_owner_to_confirm` and keeps the rows with no owner.
- `supabase/migrations/20260923170000_lien_months_creation_fallback.sql:532` is the creation-month fallback.
- Fix: drop "with approved hours".

**G. The standing rule's hint promises an FYI list that does not exist.** The rule *Send notices without asking* says *you see each send in your FYI list*. Nothing lists the sends a rule approved. *Sent on your word* in the desk's title bar lists only the notices approved on the leader's spoken word.

- `src/lib/jobs/lienDesk.ts:57` is the hint. `src/components/jobs/LienDeskModal.tsx:1511-1514` draws it as the rule's hover, and `:1518` prints the same promise under the rules (*You still see each send in your FYI list…*).
- `LienDeskModal.tsx:2241-2243` is *Sent on your word*. It lists the notices approved by the leader's spoken word, sent or still ready (`wordSent`, `:922`); nothing marks a rule's approval once the notice is sent.
- The guide *send lien notices from the Lien desk* repeats the promise in an example (*He still sees every send in his list*). It is held as written until this is decided.
- The owner's call: build the list, or change the hint and the guide's example.

~~**H. The demand letter's theft-of-services line is not tied to the attorney.**~~ Closed in v2.5030, the owner's call of 2026-10-09: the office keeps the tick. The guides *read the Texas lien rules the app follows* and *send a final demand letter* now say the line starts off and may be ticked on a job with no payment, and `demandLetter.ts`'s comment on `includeTheftOfServices` reads the same. As found: the guide *read the Texas lien rules the app follows* says the line stays off until the attorney package. It does ship off, but the office can tick it on any demand letter while the job has no payment, and nothing ties it to the Legal desk.

- `src/lib/jobsDocuments/demandLetter.ts:1139` sets `includeTheftOfServices: false`, and the comment at `:92` says *OFF until attorney sign-off*.
- `src/components/jobs/LienInstrumentsModal.tsx:1259-1275` offers the box whenever no payment is on the job.
- The owner's call: gate the box behind the Legal desk, or change the rule's words in the guide.

**I. *Add the unconditional ›* on a paid bill opens the wrong form.** On the Bill tab, a GC job's bill shows the door *Add the unconditional ›* once its money has settled. A bill paid in full is marked paid, and the Release of Lien window cannot select a paid bill. So the window opens on *Conditional · progress*, without that bill, and asks nothing.

- `src/lib/jobs/lienWaiverCell.ts:88` sets the door once the bill is settled.
- `src/components/jobs/JobFormInvoiceList.tsx` opens the window on the bill with no form named (`setWaiverFor(inv)`).
- `src/components/jobs/LienReleaseModal.tsx:160-165` (`selectableInvoices`) keeps only billed and ready-to-bill bills. `:425-433` selects the opening bill and lets it pick its own form only when that bill is selectable. Otherwise the form stays at `:417`'s `conditional_progress`.
- `mark_invoice_paid` (`supabase/migrations/20260927230000_controller_money_functions.sql:1954-1958`) flips a bill paid in full to `paid`.
- The guide *send a GC our lien waiver* says the window opens on that bill and still opens the unconditional (its steps under *A bill already sent*, and the check paragraph). Those lines are held as written until this is decided.
- The owner's call: let the window take a paid bill for the unconditional, or change the door and the guide.

**J. The billed date's hover says every clock starts there.** On a Billed or Collections row, the *Billed* line's hover in the dates under the money bar reads *The bill went out … — the day every clock below starts from*. The pay estimate counts from the bill date, but the lien row below it counts from the job's last work month.

- `src/lib/jobs/billedDatesLedger.ts:107` is the hover.
- `src/lib/jobs/lienPayRunway.ts:266` dates the lien row from the last work month (`lienByForJob(lastWork, …)`).
- The guide *read the Pipeline's money view* says the pay estimate counts from the bill date since v2.4623 (#4616).
- Fix: say the pay estimate starts there, not every clock. Shipped in v2.4697: the hover reads *the day the pay estimate below counts from*.

**K. With the property kind unset, the runway and the Lien window give different dates.** When a property's kind is not set, the Billed row's lien runway shows the residential date, a month earlier, as an assumption. The job's Lien window shows the commercial dates and says *Commercial dates shown — a residential property is a month earlier.*

- `src/lib/jobs/lienPayRunway.ts:173-179` (`lienByForJob`) uses the residential date when the kind is blank.
- `src/lib/jobs/lienDeadlines.ts:41-47` dates a blank kind as commercial, for the notice (`:41-43`) and the lien (`:45-47`). The window's warning is defined at `src/lib/jobs/lienTimeline.ts:687` and printed by `LienTimelineStrip.tsx:260` and, on a phone, through `lienTimeline.ts:710`.
- It is wider than two screens. The Lien desk's Calendar also uses the residential date (`lienCalendar.ts:250-257, 490-497`). The desk's Timeline tab, its gates, the GC on-notice window, the timeline book and the Forecast panel show commercial dates (`LienDeskTimelineTab.tsx:127`, `lienDeskGates.ts:77, 132`, `GcOnNoticeModal.tsx:891`, `lienTimelineBook.ts:227`, `ForecastWorkMonthsPanel.tsx:179`).
- The guides describe each side. *read the Pipeline's money view* (L30-32) has the runway's residential date. *send lien notices from the Lien desk* (L91) and *see when a customer will pay* (L85) have the commercial dates. *read the Texas lien rules the app follows* (L81) states the commercial dates as the whole app's rule, which the runway and the Calendar break.
- The owner's call: one rule everywhere. The earlier date is the safe one for a deadline, or every screen could show commercial dates with the warning.

**L. (built — option B, v2.4708, the owner's call 2026-10-06) The desk and the timeline disagreed about a lien with no notice.** On job 890 (2026-10-06) the desk's Affidavits pile listed the job under Coming up with *9 days left · Fix the property*, while the timeline on the same job read *blocked · no notice on record* and *Lien: gone*. Both read the same fact: July's notice window closed Sep 15 with nothing sent.

- `src/lib/jobs/lienDeskAffidavits.ts:77-84` (`affidavitGates`) makes a missing § 53.056 notice a gate the office can still clear, so the job stays in *Needs the property facts* with a countdown to the affidavit's last day.
- `src/lib/jobs/lienTimeline.ts:379` (`lienGone`) treats a sub job whose every window closed unsent as having no affidavit to file, and the strip draws the lien as blocked (a dotted ghost since v2.4652).
- Counsel's question: can a notice sent after its window still carry the affidavit, or is the claim gone for those months? If gone, the Affidavits pile should drop the job or list it under *Nothing left to claim*. If not, the timeline's *blocked* is too strong.
- Found 2026-10-06 while redrawing the timeline (v2.4652).

**M. A waiting signature request reopened with the wrong leader in Signs.** In the Release of Lien window, a waiver sent to a leader's desk, or opened for *He is here, he signs now*, reopened with the job's default leader in the **Signs** pick instead of the leader it asked. The pick is locked while the waiver waits, but *He is here, he signs now* reads it: pressing it moved the request to the default leader.

- `src/components/jobs/LienReleaseModal.tsx` resumed a draft or a waiting request from the job's releases without the row's `signer_user_id`. The pick came from the users load: the company's signer, then the job's leader.
- `signNow` in the same file rewrites `signer_user_id` to the pick when they differ. When the default leader was the signed-in user, the same button read *Sign it now* and let him sign in place of the leader asked.
- Found 2026-10-05 while the lien release guide was checked against the signer reset (v2.4567). Fixed in v2.4679. A waiting request now reopens with the leader it asked in the pick. He stays its signer even when he is off the list, until the request is taken back. A slow read can no longer resume another job's waiver. Confirm it live on a waiting waiver, then delete this item.

**N. A draft that was never asked forgets its leader.** The pick is saved only when a signature is asked. A draft whose saved Signed by line names one leader reopens with the job's default in **Signs**. Pressing **Send it to his desk** then asks the default leader to sign a page that prints the other's name.

- `buildRowPayload` in `src/components/jobs/LienReleaseModal.tsx` (the draft's autosave) writes no `signer_user_id`. A request or a signature writes it: `ensureMinted('awaiting_signature')`, the request on an issued waiver, `signNow`, and the signing itself (`src/lib/jobs/lienReleaseSignIo.ts`).
- A resumed draft keeps its saved Signed by line, because the prefill rebuild stays off for it (v2.2619). So the line and the pick can name two people.
- A draft that **Cancel request** turned back keeps the asked leader's `signer_user_id`. v2.4679 seeds the pick only for a waiting request, so that draft reopens on the default too.
- Fix: save the pick with the draft. Or, on resume, take the leader whose name matches the saved Signed by line. Saving it would not put the draft in a leader's list, because `useLienSignatureLanes` (`src/hooks/useLienSignatureLanes.ts`) reads only waiting and signed rows.
- Found 2026-10-06 by the second read of v2.4679. Shipped in v2.4698: the draft's autosave saves the Signs pick, a resumed draft opens on it, a saved leader off the list gives way to the default, and on a draft the pick is the signer of record. *give a customer a lien release* and *send a GC our lien waiver* say a draft keeps the leader you picked.
