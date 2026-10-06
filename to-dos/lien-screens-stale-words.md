---
name: "Lien screens: the app's own words that are stale"
number: 87
group: ready
status: found 2026-10-05 by the lien-guide freshness pass (read against main's code, no live look) · not started
summary: >
  Seven places on the lien screens where the app's own words promise something the app does not do,
  or name a rule it no longer follows. The help guides were patched to say what the app does today;
  these are the app's side, kept here so they are not lost. E, F and J are wording; G, H, I and K
  need the owner's call.
next: E, F and J as one small PR (a focus and two sentences); G, H, I and K once the owner says which way.
size: XS each
blocker: None for E, F and J. G, H, I and K wait on the owner.
opinion: build E, F and J — each is one line; G, H, I and K are your call.
mockup: not required — words and one focus on screens that exist
---

# Lien screens: the app's own words that are stale

## Where this came from

On 2026-10-05 the owner's coordinating session asked for every lien help guide to be read against main's code. Six read-only readers checked about 700 claims. Most findings were guide sentences gone stale, and those were patched in the guides. Items E to H went the other way: the guide matched what the screen says, and the screen is the one that is wrong. J and K came from the second read of the guide pass's fourth PR (v2.4623). The coordinating session asked that they be written here.

Four more of that kind (a fee the firm adds cannot be acknowledged, the courtesy PDF, *Cancel request* unlocking a release, *Issue unconditional* reselecting one bill) are with the owner as decisions. They are listed in the guide PRs as held sentences, not here. Item I below is here as well, because its fix is in the app's code.

This card was first numbered #85. The legal-portal train had already named its card #85 in its PRs, so this one moved to #87.

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

**H. The demand letter's theft-of-services line is not tied to the attorney.** The guide *read the Texas lien rules the app follows* says the line stays off until the attorney package. It does ship off, but the office can tick it on any demand letter while the job has no payment, and nothing ties it to the Legal desk.

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
- Fix: say the pay estimate starts there, not every clock.

**K. With the property kind unset, the runway and the Lien window give different dates.** When a property's kind is not set, the Billed row's lien runway shows the residential date, a month earlier, as an assumption. The job's Lien window shows the commercial dates and says *Commercial dates shown — a residential property is a month earlier.*

- `src/lib/jobs/lienPayRunway.ts:173-179` (`lienByForJob`) uses the residential date when the kind is blank.
- `src/lib/jobs/lienDeadlines.ts:41-47` dates a blank kind as commercial, for the notice (`:41-43`) and the lien (`:45-47`). The window's warning is defined at `src/lib/jobs/lienTimeline.ts:687` and printed by `LienTimelineStrip.tsx:260` and, on a phone, through `lienTimeline.ts:710`.
- It is wider than two screens. The Lien desk's Calendar also uses the residential date (`lienCalendar.ts:250-257, 490-497`). The desk's Timeline tab, its gates, the GC on-notice window, the timeline book and the Forecast panel show commercial dates (`LienDeskTimelineTab.tsx:127`, `lienDeskGates.ts:77, 132`, `GcOnNoticeModal.tsx:891`, `lienTimelineBook.ts:227`, `ForecastWorkMonthsPanel.tsx:179`).
- The guides describe each side. *read the Pipeline's money view* (L30-32) has the runway's residential date. *send lien notices from the Lien desk* (L91) and *see when a customer will pay* (L85) have the commercial dates. *read the Texas lien rules the app follows* (L81) states the commercial dates as the whole app's rule, which the runway and the Calendar break.
- The owner's call: one rule everywhere. The earlier date is the safe one for a deadline, or every screen could show commercial dates with the warning.

