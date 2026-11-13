---
name: What customers see — the lien letters, in the order they go
number: 326
group: close
status: built 2026-11-12 on claude/what-customers-see-lien-letters · left: the owner's look at the group, then delete the folder
summary: >
  Settings → What customers see has a new group, Lien letters: a row that says the order (notice of claim, courtesy
  notice, attorney's letter, lien affidavit, release, and the demand letter and retainage notice beside it), and a card
  for every letter on one made-up unpaid job, each drawn by the code that sends the real one.
next: The owner opens Settings → What customers see → Lien letters and reads the order and the cards. Then delete the folder.
size: M
blocker: The owner's look.
opinion: build — it is built; the look is the owner's
---

# What customers see: the lien letters (#326)

## The ask, in the owner's words

2026-11-12:

> In the settings, I would like to offer a what customer sees for all the different letters that go out and the
> different stages we have available to us as relate to liens, If I understand correctly right now we give them a
> notice and then a demand and then a final notice and then a lien. Please let me know if you can add this to the
> settings under what customers see.

## What was found

- The tab already drew three lien papers, in two groups: the § 53.056 notice as the last card under **General
  contractor**, and the demand letter and the lien release at the end of **Homeowner**. Nothing said the order.
- The app sends five more that were not on the tab: the cover letter in front of the notice, the courtesy notice
  (an email and a text, a copy for the owner and one for the builder), the attorney's letter (counsel's two kinds),
  the lien affidavit with the copy mailed after filing, and the release of record. The retainage notice was not
  there either.
- The owner's order is close. The app's is: the **notice of claim**, the **courtesy notice**, the **attorney's
  letter**, the **lien affidavit**, the **release**. Her *final notice* is the attorney's letter. The **demand
  letter** is optional and is not a step of the notices: it is a final demand with a pay-by day, sent from the job's
  Lien window to whoever owes the bill. The **retainage notice** is for money a builder holds back.
- Every letter has a pure builder the Lien desk or the Lien window sends with. **No schema change and no edge
  function.**
- *A person* mode reads a real homeowner's state on the homeowner's demand letter and lien release
  (`personJourney.ts`), so those two steps cannot leave that group.

## The decision

Mock-up: [`mockup.html`](./mockup.html), drawn from what the app's own builders wrote, on made-up data.

1. **One new group, Lien letters**, between General contractor and Subcontractor. The reader is the owner of a
   property and their builder, who is neither the homeowner we work for nor the GC as our customer.
2. **The order first.** A row of boxes over the cards: Step 1 to Step 5, then the two letters beside the order. Each
   box says when it goes in one or two plain sentences. This is the answer to *the different stages we have*.
3. **A card for every letter**, in the order it goes, and each card's line under the picture opens with its step.
   Twelve cards: cover letter, notice of claim, courtesy notice (owner's email, owner's text, builder's email,
   builder's text), attorney's letter (two kinds), lien affidavit, release of record, final demand letter, retainage
   notice.
4. **One made-up job for all of them**, so the reminder names the day the affidavit is due and the affidavit swears
   the day the notice was mailed. The days count from today by the Lien desk's own date rules.
5. **Drawn by the code that sends.** No letter's wording is written for the tab. A change to counsel's letter shows
   here the day it ships.
6. **The notice of claim moved** from General contractor to step 1 here. The homeowner's demand letter and lien
   release stay, and the demand letter shows here as well.

## Is this the best we can do?

Mostly, and here is where it is not.

- **Samples, not a job's letters.** The group teaches the order and the words. To read one job's own letters the
  office opens that job's Lien window. *A person* mode draws nothing for this group yet. **Not built**: it needs a
  kernel that reads a property owner's lien state step by step.
- **One kind of job.** The sample is a commercial job, so the house and homestead cover letters and the earlier
  days are said in the order's words and not drawn. A switch between a commercial job and a house is a later idea.
- **The envelope's other pages.** The invoice enclosed with a notice and the pay page behind the owner's copy are
  named on the cover letter and not drawn.
- **The demand letter is the homeowner's sample.** It is addressed to the sample homeowner, the one paper in the
  group not on the sample lien job.
- **On a phone** the tab runs a little wider than the screen. That was so before this change, on every group.
  **Named, not fixed here.**

## Where it plugs in

| What | Where |
|---|---|
| The made-up job and each letter | `src/lib/journeys/lienLetterSamples.ts` (new, pure) |
| The group, its cards and the order | `customerJourneys.ts` (`'lien'`, `LIEN_STAGES`) |
| The order's row over the cards | `JourneyStrip` in `SettingsWhatCustomersSeeTab.tsx` |
| The papers, by id | `journeys/paperSamples.ts` |
| The courtesy emails and texts | `customerSampleEmails.ts`, `journeys/sampleTexts.ts` |
| The registry and the contract card | `customerSurfaceRegistry.ts`, `contracts/customerContractCatalog.ts` |

## The plan

One PR. The group is of no use without its letters, and the letters have no place without the group.

## How to verify

- Unit: `lienLetterSamples.test.ts`, `customerJourneys.test.ts`, `customerSurfaceRegistry.test.ts`,
  `paperSamples.test.ts`, `sampleTexts.test.ts`.
- In the app: Settings → What customers see, scroll to **Lien letters**. Read the order. Press each card.

## Where it stands

Built with its mock-up. Left: the owner's look.
