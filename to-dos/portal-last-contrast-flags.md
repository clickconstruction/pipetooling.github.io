---
name: "The portal's last contrast flags: Tell us, the trade colours, the copper and the emails' grey"
number: 199
group: gated
status: proposed 2026-10-27 from the What everyone sees sweep (#194) · investigate before we build, the owner's note
summary: >
  PR #6314 lifted the paper palette's small print. The customer portal still shows two texts under
  3:1 in What everyone sees, on the homeowner's and the GC's portal. The first is the disabled Tell us
  button, white on the hairline colour (1.45:1). The second is the PLUM trade tag on the job band
  (2.68:1), and ELEC and HVAC read about 2:1 there. The copper eyebrows read 3.96 to 4.28:1. The legal
  and contract emails still copy the old faint grey #8a97a6, and changing them takes an edge deploy.
next: Investigate first, the owner's note of 2026-10-27. Measure every trade colour and the copper on each paper ground, decide how a disabled Tell us should look, and list the emails and functions involved. Then bring the owner options.
size: S, to be confirmed by the investigation (the emails add an edge deploy)
blocker: The investigation, then the owner's pick.
opinion: your call — the trade colours and the copper are the portal's look; change only what fails, and keep each trade recognisable
---

# The portal's last contrast flags (#199)

## The ask

The owner, 2026-10-27: *"add these two suggested tasks to the punchlist with a note to investigate
before we build"*. This is one of the two. Settings → **What everyone sees** (punch list #194)
found these while PR #6314 was checked. That PR took the homeowner's portal from 16 flagged texts to
2 by moving the paper palette's `FAINT` from `#8a97a6` to `#5e6d7c`. These are the 2 that remain,
plus the pairs next to them that the same look should settle.

## Investigate before we build

The owner asked for a look before any code. The investigation answers four questions.

1. **How should a disabled Tell us look?** The button waits until a date is picked, and until then
   it is white on `HAIR`. Find a disabled look whose word reads and that still looks unpressable,
   such as `MUTED` on the hairline (3.78:1) or a copper outline. WCAG exempts a disabled control,
   but the lens flags it, and a customer may read it as broken.
2. **Which trade colours fail, and on which ground?** Measure `PORTAL_TRADE_COLORS` on `NOTE_BAND`,
   `CARD` and `PAPER`. Find darker values that keep each trade recognisable. They copy
   `BID_SERVICE_TYPE_TAGS` in `src/utils/unifiedJobBidSearch.ts`, so check whether the app's trade
   tags should move with them or stay apart.
3. **What about the copper?** As small text, `COPPER` `#b0662f` is under 4.5:1. That covers the
   eyebrows *Account statement* and *Test report*, the headings *Agreements* and *Your payments*,
   and the link *use a different number*. Its buttons (*Send request*, *Request a bid*) are 4.28:1.
   The options: a darker copper for words only (a `COPPER_TEXT`), the whole copper a step darker,
   or leaving the uppercase bold eyebrows as they are.
4. **Which emails and functions change?** `supabase/functions/_shared/legalEmails.ts` has three
   footers in `#8a97a6`. `supabase/functions/_shared/contractSigningEmail.ts` has
   `const faint = '#8a97a6'`, and its sent HTML is pinned in `src/lib/contractSigningSend.pin.json`.
   List the functions that import them (`npm run check:edge-drift` shows what turns red) and the
   deploy that follows the merge.

## Measured

On 2026-10-27, in What everyone sees and by number:

| Where | Pair | Ratio |
|---|---|---|
| The disabled Tell us | white on `HAIR` `#ddd6c8`, 13 px bold | 1.45:1 |
| PLUM on the job band | `#e17235` on `NOTE_BAND` `#f1ece2`, 13.5 px heavy | 2.68:1 |
| ELEC on the job band | `#EE9310` on `#f1ece2` | 2.02:1 |
| HVAC on the job band | `#06b6d4` on `#f1ece2` | 2.06:1 |
| A copper eyebrow on the paper | `#b0662f` on `PAPER` `#f6f3ec`, 10.5 px bold | 3.96:1 |
| Copper words on the card | `#b0662f` on `CARD` `#fdfcf9` | 4.28:1 |
| The emails' footer grey | `#8a97a6` on white | 2.98:1 |

The sample portal has only a plumbing job, so the lens showed PLUM alone. ELEC and HVAC are
measured by number.

## Where it plugs in

- `src/lib/portal/portalTheme.ts` holds the paper palette. `FAINT` is `#5e6d7c` since PR #6314.
- `src/lib/portal/portalPayload.ts` holds `PORTAL_TRADE_COLORS`, and `src/pages/CustomerPortal.tsx`
  draws the trade tag on the job band.
- `src/components/portal/PortalPromiseAsk.tsx` holds the Tell us button, with
  `background: picked ? COPPER : HAIR` and white words.
- `src/lib/readablePairs.test.ts` (PR #6314) pins every paper text tier on every paper ground. Add
  the trade colours and the copper.

## Plan

1. The investigation and a before-and-after mock-up on made-up data, then the owner's pick.
2. A client PR for Tell us, the trade colours and the copper, as picked.
3. An edge PR to move the emails' grey to `#5e6d7c` and regenerate the pin. Deploy every importer
   after the merge (`supabase functions deploy <name>`; `create-user` keeps `verify_jwt = false`).

## How to verify

Sign in with `/dev-login?as=1` and open `/settings?tab=settings-what-everyone-sees`. Pick Who,
outside → **Homeowner**, then **General contractor**, then Every screen, then press **Check every
screen**. No portal page should show text under 3:1.

The list under *What the check found* shows only the first 6 items, so read the whole frame for the
full set. When the browser pane is hidden, CSS transitions freeze, so read colours after they
settle.
