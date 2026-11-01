---
name: "Legal desk: the settlement floor — what it does today, and five ways to show what could happen instead"
number: 218
group: close
status: built 2026-10-30 as C with A folded in, all on main — v2.6170 #6559 the gate retired · v2.6173 the attorney's read (landed inside #6567's squash; #6565 closed) with migration 20261030090000 applied · v2.6176 #6567 the paths and the walk-away line · v2.6177 #6568 the firm's side and both prints · submit-legal-portal and legal-portal redeployed · left: the owner's look at the cards on a live account
mockup: to-dos/legal-desk-settlement-floor/mockup.html
summary: >
  The office sets one settlement floor per matter, a dollar amount or a percent of the open balance,
  and the firm's *Settled* step below it becomes an ask the office signs off. The owner's read of
  2026-10-30: not every case needs a floor, cases differ in how hard they are to try, the attorney
  should settle for what can be had, and a floor that blocks a settlement costs more in collections
  and at trial. Five directions: remove the floor, make it a recorded posture, replace it with the
  attorney's read of the case and the two paths drawn side by side with a line derived from the
  cost to continue, show what a refused offer cost, or flip it so the firm records what it expects.
  The recommendation is the third with the first folded in.
next: The owner's look at a live account with an offer logged: Can we sue? with the read's chip, the paths under the bars with the green line on the claim bar, the same cards on the firm's portal; a week of use, then delete the folder. D's one line per closed matter once a matter has closed behind a refused offer.
size: built — S · M · M · S
blocker: None. The look is the owner's.
opinion: your call — the code is done; the look at the cards live is yours, and D waits for history
---

# Legal desk: the settlement floor (#218)

## The ask

The owner, 2026-10-30, after #214 drew the money as bars with the floor as a mark on the claim: *"not all of
the legal items need a settlement floor. Some cases are hard to try and some are easy to try. They should be
settled for what they are able to be settled for, and that should be done by the attorney, and we get what we get.
If they don't settle it costs us more in collections and in taking them to trial."* His question: *"how could we
improve the settlement floor in the Legal desk to better represent what is happening and what could happen?"* And:
*"removing it is also an option."*

The repo is public, so every name and figure here and in the mock-up is invented.

## What the floor does today

**Where it lives.** Two nullable columns on the matter, `legal_matters.settlement_floor_amount` and
`settlement_floor_pct`, one or neither (`legal_matters_settlement_floor_check`: amount > 0, percent in (0, 100],
never both). Both null means no floor, and that is the default on every matter. Migration
`20261006140000_legal_settlement_floor.sql` (v2.4643, punch list #85 item 20, the owner's decision of 2026-10-05:
"settlement authority is a threshold").

**Who sets it.** Only the office (dev · master_technician · assistant · controller), through one RPC,
`legal_set_settlement_floor`, from two doors:

- The Fees & steps tab's **Settlement authority** block (`SettlementFloorEditor` in `LegalDeskFirmPanels.tsx`,
  v2.5759): one line, *The firm may settle at* **[any amount ›]** *The firm settles without asking us.*, and once
  set **[80% or more ›]** *That is $11,400.00 today. Below that, the firm asks us.* A tap opens a slider with a % box
  and a $ box that move together (`settlementFloorControl.ts`); the line beside Save says what it writes (*Saves as
  80% of the balance, so it moves as payments land.* / *Saves as $12,000.00, whatever the balance becomes.* / *Saves
  as no floor. The firm never has to ask.*). The block shows while the matter is with the firm or in house (v2.5847).
- The **Mark attorney ready** sheet's optional field, *Settlement floor (optional): the firm may settle at [___] [% of
  the balance ▾]*, written right after the release so the firm never sees the matter without it.

Every save writes a `note` entry on the matter (*Settlement floor set: the firm may settle at $12,000.00 or above* /
*…at 80% of the balance or above* / *Settlement floor cleared: the firm may settle at any amount*), which the firm
reads on its portal like any entry.

**The firm reads it, and cannot set it.** `legal-portal` sends `settlementFloor: { amount, pct }`; the matter card
(`LegalFirmMatterView.tsx`) reads **Settlement authority:** *You may settle at $11,400.00 or above (80% of the
balance). Below that, ask.*, or *No settlement floor: you may settle at any amount.* The **Record a step → Settled**
form's *Settlement amount* box is required when a floor is set and optional without one (`LegalPortal.tsx`). The
printed packet (`legalFirmPacketPrint.ts`) does not carry the floor; neither does the office print or the narrative.

**The one thing it gates.** `submit-legal-portal`, on a `settled` step, with the shared kernel
`_shared/legalSettlement.ts` (`settlementFloorOf`, `settlementFloorDollars`, `settlementBelowFloor`,
`matterOpenBalance`): at or above the floor the step goes through and the stage moves to *settled*. Below it, or when
a percent floor's balance cannot be read, the step is saved instead as a `question` entry with `meta.flavor =
'settlement'`, `proposedAmount` and `floor`; the stage does not move, and the firm's notice reads *$9,000.00 is below
the office's floor of $11,400.00. It went to the office as a settlement ask. The stage moves when they sign off.*

**What the office sees of an ask.** The conversation on Fees & steps: *D. Reyes at the firm asked to settle at
$9,000.00* with **Sign off** / **Not yet** and a note (`SettlementAnswer`), the chip *waiting on you*. The Needs You
card counts it first: *1 settlement below your floor to sign off* (`dashboardNeedsYou.ts`). `legal_answer_settlement`
writes the answer (*Signed off: settle at $9,000.00* / *Not yet — the note*), acknowledges the ask, and on a sign-off
moves the stage to *settled* with a step entry *Settled at $9,000.00 — the office signed off*, in one transaction; it
refuses once the matter is no longer with the firm. A *Not yet* leaves the stage where it was and the firm records a
new step or proposal.

**Every other reader, and what each does with it.**

| Reader | What it does with the floor |
| --- | --- |
| The four questions (`deskQuestions.ts`) | Nothing. *Can we sue?*, *How much?*, *What's left for us?* and *What could go wrong?* never read it. |
| `LegalWorth` (`legalPacket.ts`) | Nothing. The verdict *worth it · marginal · not worth it* is net = claim − the firm's % − the filing cost, floor or no floor. |
| The money bars (`moneyBars.ts`, v2.6105) | The floor in dollars today is a mark named *our floor* (amber) on the claim bar beside every standing offer; the claim bar is drawn only when there is added retainage, a standing offer or a floor; a floor past the claim on record stretches the bar with a hatched *asked beyond the claim on record*. |
| The write-down panel (`AccountWriteDownPanel.tsx`) | Nothing. It shares the slider's shape, not the value. |
| The Timeline (`legalTimeline.ts`) | Nothing. An offer's expiry sits there; the floor's note entry is an entry like any other. |
| The office print, the narrative, the firm's printed packet | Nothing. |
| In house (v2.5847) | The editor opens in house as it does with the firm; the floor travels with the release. |
| The guides | *share your attorney their portal* (the settlement authority paragraph), *review a collections account…* (the bars paragraph and the in-house section). |

**What the reading says is missing.** The floor is one number the office picks on a slider whose only marks are
*Any amount · 50% · The full balance*. Nothing on the panel, the bar or the firm's card says what trial would net
after the firm's cut and its costs, how hard the case is to try, or how long each path takes. So a floor can be set
above what even a full win at trial would net, which is exactly the owner's worry, and the desk cannot tell. The
floor's words to the firm are about permission (*you may… below that, ask*), not information. A refused offer leaves
no trace of what it cost: *not yet* sits in the conversation and the next step comes months later with nothing beside
it. And on the one live matter the floor was first written into the narrative as a sentence, before in house existed,
which says how little the control was reached for.

## The five directions (mockup.html)

Each is drawn as the desk's Fees & steps block, the claim bar and the firm's card, with the words each would say.
Invented matter: a dental clinic job under a GC, two open bills $14,250.00, retainage no bill asks for yet
$2,100.00, so the claim is $16,350.00; their offer $9,000.00 on Oct 20; our counter $13,500.00 to Nov 5; the firm
33% and $350 to file; today's floor 80% of the balance, $11,400.00.

**A · Remove it.** The *Settlement authority* block and the Mark attorney ready field go. The firm's card reads
*Settle as you can. Record the settlement with its amount.*; the Settled step's amount is always required, so the
record carries it; the step always moves the stage. The claim bar keeps every offer as a mark and loses *our floor*.
Needs You reads *1 settlement to apply* (the payment step that already exists) instead of *1 settlement below your
floor to sign off*. No migration: the columns stay null and unread; open asks can still be answered until none are
left. Loses: the office's say on a lowball offer before it is done, and a figure the attorney can point to when the
other side asks what we would take.

**B · Optional, with a posture.** The block becomes **How we settle**: a chip *Settle as counsel can ›* by default,
with one line of why (*a hard case: the GC disputes the change order*), and a **Hold a floor…** door that opens
today's slider for the rare matter. The firm's card reads the posture as an instruction, not an absence: *The office
asks you to settle as you can. Record the settlement with its amount.* One column, `settlement_posture`. Honest note:
the floor is already optional and already defaults to none; B changes the words and demotes the slider, which is
worth doing only if a floor is kept at all.

**C · Replace it with what could happen.** Three parts. (1) **The attorney's read**: on the portal, a small act
*How this case tries*: Easy or Hard, one line why, the costs to try it, and the months to a judgment, dated and
named like every firm act (`submit-legal-portal` kind `read`); the office can set the same in house. The desk shows
it as a chip on *Can we sue?* (*hard to try · the firm's read, Oct 22*) and the why under it. (2) **The two paths,
side by side**, under the money bars: *Settle now at their offer* → the offer, the firm's cut on it, what we keep,
when (within the month); *Collections and trial* → the claim, the firm's cut, the filing cost, the costs to try, what
we keep at a full win, when (the months to a judgment, then collecting it). On a hard read the trial path says *a
full win is not the likely end. The firm's call.* (3) **The walk-away line, derived**: the offer at which settling
nets the same as a full win at trial, `claim − (filing + costs to try) / (1 − the firm's %)`, $11,648.51 on the
invented matter, drawn on the claim bar as *above this, settling beats a full win*. No gate: the firm records the
settlement and the stage moves; the office sees what it netted against the paths. Kernel `settlementPaths.ts`, pure,
over `LegalWorth`, the firm's fee row, the firm's read and the standing offers; the firm's portal draws the same paths.

**D · Show what the floor has cost.** One line on a closed matter: *Their offer of $9,000.00 on Oct 20 was refused
under the floor. The case settled Mar 14 at $8,500.00 after $1,900.00 more in costs, 145 days later.* And a rollup
on the Legal desk's firm window: refused offers, how each matter ended, dollars and days apart. Reads the Offers log,
the settlement asks and the settled step; nothing new is stored. Honest note: the floor shipped 2026-10-05, so there
is almost nothing to read yet; D is the lens that proves or disproves the floor over a year, not a direction on its own.

**E · Flip it.** The firm records what it expects, not the office what it demands: *likely settles between $8,000
and $10,500*, drawn as a band on the claim bar, with the read's why. The office acknowledges it. Loses: a firm may
not want a range in writing; a band with no costs beside it still does not say what we net. E's band folds into C as
the read's optional range if the firm offers one.

## Is this the best we can do?

- **Which one answers "what is happening and what could happen"?** A shows what is happening (the offers on the
  bar) and nothing about what could. B is today with better words. D is what did happen, read later. E is the firm's
  guess with nothing to weigh it against. C is the only one that draws both: the offers as they stand, the attorney's
  read of the case, and each path's net and time, so the office reads *$6,030 within the month* against *$7,804.50 in
  nine months if we win it all*, with *hard to try* beside it, and decides nothing by slider.
- **What C loses, and the answer.** The office's say on a lowball offer: the desk still shows every offer on the bar
  against the derived line, the Offers log still takes *Countered*, and the firm still reads the office's questions;
  what goes is the stage waiting on a sign-off, which the owner named as the cost. A figure the attorney can point to:
  the derived line is one, and an honest one, since it moves as the firm's costs land and reads *settling beats a full
  win above this*, not *the office will not take less*.
- **Why a derived line and not a probability.** The desk never invents a figure (the rule v2.6105 kept). A chance of
  winning would be one. The read is the attorney's word in two values and a sentence, and the line is arithmetic on
  numbers the desk already holds or the firm types.
- **One rate.** The firm's row carries one `contingency_pct`; firms often charge less before suit than at trial. If
  the owner's firm does, the trial path wants a second rate on the firm row. The mock-up draws one rate and says so.
- **Keep the gate as a per-matter door (B inside C)?** It is one more thing to explain, and the owner's words are
  that the attorney settles. The recommendation leaves it out; the columns stay, so it can come back without a migration.
- **The recommendation: C with A folded in**, as a train of four small PRs, then D's one line per matter once a
  matter has closed with a refused offer behind it.

## Where it plugs in

- The floor: the migration above; `_shared/legalSettlement.ts`; `settlementFloorControl.ts` and
  `SettlementFloorEditor`; `LegalDesk.tsx` (`setSettlementFloor`, `answerSettlement`, the ready sheet's field);
  `LegalDeskPacketTab.tsx` (the editor's slot, the conversation's `SettlementAnswer`); `legal-portal` (the payload),
  `submit-legal-portal` (the gate), `LegalFirmMatterView.tsx` (the card line), `LegalPortal.tsx` (the step form);
  `dashboardNeedsYou.ts` (the count); `moneyBars.ts` (the mark); `legalAsks.ts` (the ask's words).
- The read and the paths would be new: columns on `legal_matters`, one portal act, `settlementPaths.ts`, a panel under
  `LegalMoneyBars`, and the same panel on the firm's view. The fee model is the firm row's `contingency_pct` /
  `filing_cost` (`legalFirmFacts.ts`), default 33% and $350 (`LEGAL_DEFAULT_FEE`).
- The costs so far are the matter's `fee` / `cost` entries (`firmFeeRows`), already on Fees & steps.

## The plan, on a yes to C

| PR | What | Size |
| --- | --- | --- |
| 1 | The gate goes: a *Settled* step always moves the stage and its amount is always required; the *Settlement authority* block, the ready sheet's field and the *our floor* mark are retired; the firm's card reads *Settle as you can…*; Needs You counts a settlement to apply; open asks stay answerable until none remain. No migration. Guides, GLOSSARY, ACCESS_CONTROL, EDGE_FUNCTIONS. | S |
| 2 | The attorney's read: migration (`counsel_read`, `counsel_read_why`, `counsel_cost_to_try`, `counsel_months`, `counsel_read_at`, the recorded-by name), the portal act, an office RPC for in house, the chip on *Can we sue?* with the why. | M |
| 3 | `settlementPaths.ts` and the panel under the bars: the two paths, the derived line on the claim bar, one sentence. | M |
| 4 | The same paths on the firm's view and in the printed packet. | S |
| later | D: the one line per closed matter, then the rollup. | S |

## How to verify

On a ZZ TEST account on the dev server, as the office: Fees & steps shows no *Settlement authority* block; as the
firm on its portal, *Settled* with an amount moves the stage at once and the desk's Needs You reads *1 settlement to
apply*. After PR 2, the firm's *How this case tries* lands on the desk as the chip with its why. After PR 3, an
account with a logged offer draws the two paths with the derived line on the claim bar, and the sentence under them
reads the same figures. `npx vitest run src/lib/legal src/components/jobs/legal` after each.

## Where it stands

**Built 2026-10-30, the owner's pick of C ("Build C").** Four PRs, each with its release note, fragment, guide and doc
amendments: v2.6170 (#6559) retired the gate; v2.6173 the attorney's read as a note entry with the office's
`legal_set_counsel_read` (migration `20261030090000`, applied) and the firm's portal act; v2.6176 (#6567) the paths
kernel, the cards under the bars and the walk-away line on the claim bar; v2.6177 (#6568) the same cards on the firm's
portal and in both prints. The queue took #6567 ahead of #6565, whose commits it carried, so v2.6173 landed inside
#6567's squash and #6565 closed unmerged. `submit-legal-portal` and `legal-portal` are redeployed from main. Not done:
the owner's live look, and D. The owner's calls left open: a second firm rate for trial (one `contingency_pct` today),
and whether B's *Hold a floor* door ever returns (the columns stay null for it).

