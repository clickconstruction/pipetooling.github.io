---
name: "Lien windows: when each paper can go out"
number: 42
group: gated
status: option 1 built as Way A + C (v2.3815) · left: options 2 and 3, and counsel's three answers
summary: >
  Every date the Lien desk shows is a last day. Someone unsure of the rules reads "Oct 15" as
  "wait until Oct 15", and six jobs on the desk have a closed June window nobody used. Show
  each paper's first day too: the notice from the 1st of the month after the work, the lien
  from the day the notice is mailed. Three placements: on the job (option 1), a "When can I
  send?" card in the header (option 2), the guides (option 3).
next: Ask the firm the three questions below; then decide whether option 3 (the guides) and option 2 (the card) are still wanted now that the timeline shows first days.
size: XS + S
blocker: Counsel on the three questions.
ver: v2.3815
opinion: your call — option 3 is a small docs PR worth doing once counsel answers; option 2 may be unnecessary now that the timeline shows first days.
---

# Lien windows: when each paper can go out

## The ask

The owner, 2026-09-24: *"I think it's important to let someone know the rules for liening in Texas and especially how soon they can send a lien notice versus how soon they can send a proper lien. Help me think of a way to tastefully add this information where it could be easily referenced for people who are uncertain or unsavvy."*

## What is missing today

The desk shows every paper by its **last day**: the timeline strip's dots, the Months table's *mail by*, *Next on the path*. `§ The rules` (v2.3594) opens a guide written for someone who already knows the statutes. Nothing on the desk says when a window **opens**. On 2026-09-24 the desk showed nine jobs in *Missed* and six with *Jun window closed · not noted*.

| Paper | First day | Last day (commercial / residential) |
|---|---|---|
| § 53.056 notice | The 1st of the month after the work, once unpaid | 15th of the 3rd / 2nd month after |
| § 53.052 lien (affidavit) | Once the notice for those months is mailed and the bill is still unpaid | 15th of the 4th / 3rd month after the **last** month worked |

Sooner holds back more money: the owner is liable only for what it pays the GC after the notice arrives (§ 53.081, § 53.084(a)).

## The mock-up

[`mockup.html`](mockup.html) — drawn from J473 on the live desk (names left off): the three options before and after, the header card with a working commercial/residential toggle, the two guide edits, and a side-by-side with sizes.

## The three options

1. **On the job** — `lienTimeline.ts` gains a first day per step (`opensOn`) and new *Next on the path* words; `LienTimelineStrip.tsx` draws spans in `row` layout (`list` gains a first-day line, `mini` is unchanged); `LienDeskMonths.tsx`'s Window column gains *open since …* and a used-up bar. The law firm's portal reads the same kernel. Size M.
2. **"When can I send?" card** — `LienWindowsCard.tsx` beside `LienRulesDoor` on the desk header and the Lien window's tab row: one picture (June work as the example), three sentences, no cites, a commercial/residential toggle, dates from `lienDeadlines.ts`, an *On this job* line when a job is selected. Size S.
3. **The guides** — a *When each paper can go out* section in `understand-how-liens-work-and-which-lien-tool-to-use.md`, a *How early each paper can go* row in `texas-lien-rules-the-app-follows.md`, three lines under its *Not yet verified*. Fixes on the way: the beginner guide's stale "retainage … not modeled" (the Retainage tab shipped v2.3753), and `lienRuleCites.ts`'s § 53.003 door (opens *The month rule*; § 53.003 is the weekend/delivery row) and § 53.152 door (its row cites §§ 53.281–286). Size XS.

Recommended order 3 → 1 → 2: the guide holds the wording the other two link to.

## The decision so far

**2026-09-24 — option 1 picked, and today's view stays.** The owner: *"I wanna maintain the old view, but I also like the new view."* [`both-views.html`](both-views.html) draws three ways to keep both, each one clickable:

- **Way A — a Steps · Windows switch** on the strip (recommended). Steps is today's view, unchanged, and the default. The choice is remembered per viewer in browser storage (a convenience; it falls back to Steps). The Months table follows the switch.
- **Way B — stacked**: today's strip, with *Show when each window opens ▸* underneath opening the window rail. Both at once, about 150 px taller.
- **Way C — Steps, one line richer**: each dated dot gains *open since Aug 1*, and the affidavit gets *opens when the notice is mailed*. It can also go inside Way A's Steps view.

**Built 2026-09-25 as Way A with Way C's line (v2.3815)** — the switch on every row and list strip, remembered per browser (`src/hooks/useLienTimelineView.ts`); Steps shows the green first-day line; the Months grid follows the switch. `docs/recent-features/v2.3815.md` has the details.

## For counsel, before 1 or 2 ship

1. May a § 53.056 notice go out for a month whose bill is not yet past due?
2. May the affidavit be filed the day after the notice is mailed on an ordinary job, not only when the GC has stopped answering (the 2026-09-22 memo: *"File as soon as the notice is out and the claim is still unpaid"*)?
3. May a sub still on the job file for months already finished?

Until counsel answers, the first-day lines sit under *Not yet verified* and the card's line 2 says only *"once the notice is in the mail"*.

## How to verify

Dev-login on localhost, `/jobs?tab=stages&liendesk=1`, pick J473 (Jul + Aug, commercial dates): the Jul notice reads *open since Aug 1 · mail by Oct 15*, the lien row starts at today and ends Dec 15. Flip a residential job: every first day stays, every last day moves a month earlier.
