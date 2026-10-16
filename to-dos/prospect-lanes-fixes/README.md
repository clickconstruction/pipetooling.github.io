---
name: "Prospects lanes: the walk's six fixes"
number: 113
group: close
status: built 2026-10-16 in six PRs (v2.5578 #5781, v2.5579 #5782, v2.5580 #5783, v2.5581 #5784, v2.5582 #5785, v2.5583 #5786), each walked live on the dev server against prod with ZZ rows, all deleted; #5774 (v2.5574) closed the window height before them
summary: >
  A live walk of Prospects Finding Lanes (#110) as a caller, with made-up entries, found six places to
  improve: a refreshed lane painting the Customers deck under its tab, New Prospect and Edit prospect
  running off the screen, no way to edit a job on a lead, the same company typed twice with no word,
  an empty lane pointing at the wrong control while its clock counted, and a bare Due chip beside
  never called. Each is drawn once as Now vs the fix in mockup.html, with the critique and the second
  pass: a render guard behind the loader fix, edit in place, one lookup for every double, the clock
  waiting for a card, Escape on an untouched window, and the ZZ rule for prospects.
next: Use the lanes for a week. Then the two leftovers that are the owner's: the "GC test bidding project, delete me" project on the GC board, and whether a customer double's "With us since" should read the first job's year rather than the record's.
size: S · S · S · S · S · S
blocker: none
opinion: shipped as drawn in B; nothing changed the lanes' shape or their data, and the one new write is an UPDATE on a job row.
mockup: to-dos/prospect-lanes-fixes/mockup.html
---

# Prospects lanes: the walk's six fixes

## The ask

Grace, 2026-10-16, after #110 shipped: walk the live lanes as a user, make test entries with fake
names, and report where to improve. Then: "help me make mockups of where to improve and then ask
yourself is this the best we can do?" Then: "I like all of your suggestions, please build them",
and "test live when complete".

## What the walk found

| # | Where | What a caller saw | Fixed by |
|---|---|---|---|
| 1 | Any lane, on a refresh or a bookmark | The Customers deck under the Jobs to GC or Subs tab, wearing the lane's last press and order toggle. The deck's kind started as customer and two loads raced. | v2.5578 |
| 2 | New Prospect, Edit prospect | Save and Cancel below the screen on a laptop and a phone, no scroll, Escape did nothing. | #5774 (height), v2.5582 (Escape) |
| 3 | The Jobs box on a lead | An open job offered Lost and Drop only; a wrong bid day meant Drop, Remove, type it again. | v2.5580 |
| 4 | New Prospect on Subs and Jobs to GC | The same company typed twice made a second card and the strip counted both. | v2.5579 |
| 5 | An empty lane | "Add prospects in Prospect List" while the control is New Prospect; the call clock ran under nothing and stamped its minutes on the first card added. | v2.5581 |
| 6 | A never-called card | A bare Due chip beside never called. | v2.5581 |
| + | Test rows on prod | A ZZ sub sat on the strip and in the office's queue until deleted by hand; a "blahfoo" quick note sat on every card. | v2.5583; the note deleted by hand |

## Is this the best we can do? What the second pass changed

- **The race fixed and stopped there** became two guards: the loader keeps a request counter, and the deck never draws a card whose kind is not the lane's (`cardOnLane`), saying *Loading Subs…* instead. A future leak can only ever show as that line.
- **An Edit form under the list** became **edit in place**: the row becomes the form where it sits, so the job never shows twice and the box does not grow past the card on a phone.
- **A third warning with a third rule** became **one lookup, one sentence, one door** (`companyDouble`): this lane, another lane, the bench, the customers, in that order; the two warnings that existed became its first two cases.
- **Hide the clock** became: the card's clock starts with the card; the day's clock stays the sum of card clocks plus what is recorded, so an empty lane's minutes are never counted anywhere (the mock-up's line that *my day* keeps running was not built, on purpose: there is no prospect to record them against).
- **Escape on an untouched window** (not in #5774): both windows hold the house's leave guard, close while clean, ask while dirty.
- **The ZZ rule for prospects**, so the next walk costs the office nothing.

## Where it stands

Built 2026-10-16 in six independent PRs cut from main, walked live on the dev server as the dev against prod data with two ZZ rows (deleted after), then armed for the queue.

| PR | Version | What it did |
|---|---|---|
| #5781 | v2.5578 | A refreshed lane shows its own deck: the kind read from the link first, the newest load wins, a card drawn only on its own lane (`src/lib/prospects/laneLoad.ts`). |
| #5782 | v2.5579 | New Prospect says where a company already lives: one lookup over this lane, the other lanes, the bench and the customers; Open it, Link this lead to them, Save anyway (`companyDouble.ts`, `companyDoubleIo.ts`). |
| #5783 | v2.5580 | Edit a job on a lead where it sits: the row becomes the Jobs box's one form; Save changes (`jobDraftOf`, `jobFromDraft`, `updateProspectJob`). |
| #5784 | v2.5581 | An empty lane names its control; the clock waits for a card; the Due chip waits for a first touch (`deckWords.ts`). |
| #5785 | v2.5582 | Escape closes an untouched New Prospect or Edit prospect; a touched one asks (`windowLeave.ts`, `useLeaveGuard`, `LeaveQuestion`). |
| #5786 | v2.5583 | A ZZ test prospect stays out of the office's lanes (`zzProspects.ts`; Activity's loader takes `hideZz`). |

**Walked live 2026-10-16** on the integration of all six: twelve paints sampled on each lane's full load showed only the lane's own words, never another lane's card; the empty words and both presses; Escape on an untouched window, the question on a touched one, Keep editing, Leave clearing the boxes, the backdrop both ways; a fresh card's clock at 00:02 after fifteen seconds on the empty lane, no bare Due chip; the double line for this lane by name, for another lane by phone, for a customer with Link and Unlink, Save anyway, and Open it landing on the card on its lane; a job edited in place with its day moved and the row updated, + Add a job closing an edit; the ZZ rows gone from the deck, the strip, the list and a direct link with the dev's switch off, back with it on.

**Not built, on purpose:** blocking a double (two branches of one company are real); Remove on an open job row; a Notes box on the sub form; the day clock ticking on an empty lane.

**Leftovers for the owner:** the *GC test bidding project, delete me* project on the GC board (the GC walkthroughs may still use it); a customer double's *With us since* reads the record's year, which for an imported customer is the import's year, not the first job's.

## How to verify

1. Open `/prospects?tab=follow-up&kind=gc-leads` from a bookmark with the lane empty: *Nobody on Jobs to GC yet. New Prospect adds the first lead.*, never a customer's card.
2. Press New Prospect, press Escape: it closes. Type a letter, press Escape: *Leave without saving?*; Leave clears the boxes.
3. On Subs type a company already on the lane: one line names the lane and when it was called; Open it opens the card; Save reads Save anyway.
4. On a lead's card press Edit on a job, move the bid day, Save changes: the row reads the new day.
5. A fresh card's *this call* reads 00:00, and a never-called card shows only *never called*.
6. As a dev with Show ZZ test jobs off, a ZZ-named prospect is on no lane, strip, list or Activity.
