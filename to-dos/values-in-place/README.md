---
name: "Values in place: where else the app should mark its values and change them where they sit"
number: 399
group: gated
status: asked 2026-11-18 · the owner named values in place, an idea from #382's spike, as something he wants across the app, and asked where else it belongs · the whole app surveyed on main the same day by four read-only passes (liens, GC and scheduling · jobs and billing · bids and buying · people) · 60 places found, 32 of them strong fits · 21 of 22 sampled claims checked against the code on main · the shared piece is built (v2.7985, #382's PR 1) · no screen here is built
summary: >
  #382 approved one way to draw a value on a screen. A date, a count, a name or an amount is drawn apart
  from the words. If a person can change it, it is underlined and tinted, and a press turns it into a field
  right there with Keep and Cancel. If the app works it out, it is plain bold and updates by itself. One fact
  sits on each line, with the values in a column. This card lists the other screens where that look fits,
  what the shared piece must hold before they can use it, and an order to roll it out.
next: The shared piece is on main (v2.7985, #382's PR 1). Take the first group below, one screen a PR.
size: L as a train, one S per screen once the piece exists
blocker: None in the code. The shared piece this card waited on is on main (v2.7985).
opinion: build, one screen at a time, after the shared piece — the owner asked for it across the app, and one piece keeps every screen's look the same
---

# Values in place (#399)

The idea and its rules live in [#382, section 5](../before-we-start/README.md#5-values-in-place). This card
does not repeat them. It holds where else they apply. The words to ask for it on any screen are
*give this screen values in place*.

## The ask, in the owner's words

> Use values in place on this screen. Mark every date, count and name apart from the words. Underline and
> tint the ones a person can change, and let them change it right there. Bold the ones the app works out.
> One fact per line, with the values in a column.

He asked to find *all the other places in the app we should apply this approach as well*.

## What the shared piece must hold first

These came out of the survey. #382's PR 1 should know them before it fixes its shape, or the screens below
will each grow their own copy.

**Held, as of v2.7985.** The piece is `src/components/valuesInPlace/ValuesInPlace.tsx` over
`src/lib/valuesInPlace.ts`. How it holds each need below, with the name of the prop, is the table in
`docs/recent-features/v2.7985.md`. In short: `locked` is the third look, `fromDefault` and `backToDefault` the
fourth kind, `hint`, `preview` and `reason` the room around the field, `onKeep` the save a screen hands in,
`val` with `ValueSentence` the parts a kernel hands back, a dotted line under words in the text colour the
look, `⟪ ⟫` the marker, 44 px the phone's press, and `ValuesInPlaceOff` the off switch.

- **A third look: shown but locked.** Many values can be changed, but not by this person or not now.
  `LockTag` in `src/components/personDesk/personDeskShared.tsx` already draws one kind of it.
- **A fourth kind: a company default this record may override.** Markup, rates and terms read from a
  default until someone sets their own, and the screen should say which it is.
- **Room around the field** for a reason, a preview of what the change will do, and a press back to the
  default.
- **Saves of more than one shape.** Some screens save through an autosave engine, and some change a value
  that another record reads. The piece takes a save function and does not assume one write.
- **Kernels that return finished strings.** Many kernels hand the page a whole sentence with the value baked
  in. They need to hand back parts, as the spike's `sentenceParts` does.
- **A look that collides today.** Underlined blue already means a link or a window in places, such as
  `src/components/gc/GcPartnerName.tsx` and the amounts on a pay stub. The marker `⟦ ⟧` is already used in
  `src/lib/jobs/lienPaperGaps.ts`. The piece picks a look and a marker that clash with neither.
- **Phone height.** A press is 44 points tall on a phone (`PHONE_PRESS_MIN_HEIGHT`), and so is a value that
  opens a field.
- **An off switch.** Screens a firm or a read-only account sees draw the values without the press.

## Near pieces that exist today

None is shared. Each is a candidate to fold into the piece or to be replaced by it.

- `src/components/jobs/InlineBillDateEditor.tsx`
- `src/components/bids/BidPlanSetsField.tsx`
- `src/components/followUp/OwedStrip.tsx`
- `src/components/personDesk/personDeskShared.tsx` (`DeskRow`, `LockTag`)
- `src/lib/jobs/lienNoticePreview.ts` (`typed` and `derived`)
- `src/components/FinishedDateInput.tsx`

## The strong fits, by area

Each line is one screen and one PR once the piece exists. How each screen changes its values today was
not checked line by line; each PR reads that first.

### Liens, GC and scheduling (8)

| Screen | The values |
|---|---|
| `LienLastWorkDayLine.tsx`, `LienTimelineStrip.tsx` | The last day of work, and the days that follow from it |
| `LienDeskRetainagePane.tsx` | Retainage dates and amounts |
| `LienDeskNoticePane.tsx` | Notice dates and the deadline worked out from them |
| `LienDeskAffidavitPane.tsx` | The owner's answers (`ownerCallWords`) |
| `src/lib/jobs/lienGateRow.ts` and its rows | Each gate's date and state |
| `src/lib/jobs/lienTimeline.ts` and its timeline | Every date on the timeline |
| `DevelopmentTripsLook.tsx` (`OpenTrip`) | A trip's days, its job and its billing word |
| `src/lib/plans/plansByDateCards.ts`, `PlansByDateItemCard.tsx` | A plan's date and who it is for |

### Jobs and billing (6)

| Screen | The values |
|---|---|
| `BilledDatesLedger.tsx`, with the evidence block built in `JobsStagesTab.tsx` | A billed row's dates |
| `BillCustomerEditDatesDialog.tsx`, opened from the Bill Customer window | A bill's dates and due date |
| `StagesUnifiedInvoiceRow.tsx`, `StagesEstBillDateModal.tsx` | An estimated bill date |
| `JobFormInvoiceList.tsx` | Each bill's date and amount |
| `JobFormPaymentLine.tsx` | A payment's date, amount and method |
| `JobTargetLine.tsx` | A job's target date |

### Bids and buying (10)

| Screen | The values |
|---|---|
| `BidPreviewModal.tsx` | The bid's dates, amounts and names |
| `BidLogContactControl.tsx` | The last contact's date and who |
| `BidsCallQueueTab.tsx` | A follow-up date |
| `BidMoneyLine.tsx` | The bid's amounts |
| `BidGcSentPanel.tsx` | When it went to the GC and to whom |
| `BidGcDetailsEditor.tsx` | The GC's details |
| `BidRfiTab.tsx`, `BidChangeOrderTab.tsx` | Values that come from the bid |
| `EstimateSentHeader.tsx` | The good-through date |
| `src/pages/Prospects.tsx` (the Follow Up card) | The next follow-up date |
| `PriceBreakdownCard.tsx` | The markup |

### People (8)

| Screen | The values |
|---|---|
| `DashboardMyHoursBlock.tsx`, `PeopleUtilizationTab.tsx` | Hours and targets |
| `PersonDeskPaySection.tsx` | Pay rates and their dates |
| `ChecklistManageTab.tsx` (`renderLibraryRow`) | A task's repeat, day and who |
| `AssignedStageCard.tsx` | A stage's start |
| `PeopleScoreboardTab.tsx` | Targets |
| `PersonDeskAccessSection.tsx` | Role and access |
| `UsersTabAwayGroup.tsx` | Away dates |
| `PeopleVehiclesTab.tsx` | A vehicle's dates and who drives it |

The other 28 places the survey found were weaker fits: values that are read only, screens a firm reads,
or lines where a value is changed so rarely that a window is fine. They are not listed. Survey again when
the first group ships.

## An order to roll it out

1. **#382's PR 1**, the shared piece, holding the needs above. Built, v2.7985.
2. **The Lien desk group.** Its kernels already split typed and worked-out values (`lienNoticePreview.ts`),
   and its dates drive deadlines, so a person sees at once what a change moves.
3. **Jobs and billing.** Start with the Bill Customer dates, where today's cuts left the dates dialog its own
   file.
4. **Bids and buying**, then **People**, where pay and access want the locked look first.

## Calls left, each with its default

| Call | Default |
|---|---|
| Does a changed value on a lien date save at once, or ask first? | Ask first when it moves a legal deadline, and save at once otherwise |
| Which look does a company default wear? | Bold with a small *default* word after it, and a press to set this record's own |
| Is a screen done when every value is marked, or only the ones a person changes? | Every value, as the owner's words say |

## How to verify

Each screen's PR shows the screen before and after at desk and phone width, in light and dark. Its render
test presses one changeable value, types, presses Keep and sees the save called once, then presses another,
presses Escape and sees nothing saved. A worked-out value has no press.

## Where it stands

Surveyed on 2026-11-18. The shared piece is built (v2.7985, #382's PR 1). No screen on this card is built.
