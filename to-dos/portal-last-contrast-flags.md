---
name: "The portal's last contrast flags: Tell us, the trade colours, the copper and the emails' grey"
number: 199
group: gated
status: investigated 2026-10-28 on branch claude/198-199-contrast-investigation · every trade colour and the copper measured on every paper ground, the waiting button's three looks drawn, the functions listed · three calls wait on the owner; the emails' grey is a go
summary: >
  PR #6314 lifted the paper palette's small print. The customer portal still shows two texts under
  3:1 in What everyone sees, on the homeowner's and the GC's portal. The first is the disabled Tell us
  button, white on the hairline colour (1.45:1). The second is the PLUM trade tag on the job band
  (2.68:1), and ELEC and HVAC read about 2:1 there. The copper reads 3.73 to 4.39:1 as words. The
  legal and contract emails still copy the old faint grey #8a97a6, and changing them takes an edge
  deploy. The investigation of 2026-10-28 measured every pair and recommends each trade colour a
  step darker along its own hue, muted words on the hairline for a waiting button, and the one
  copper a step darker to #9a5b2b with a sweep of the 23 files that copy it.
next: The owner marks the three calls on the mock-up (the trade tag, the waiting button, the copper). Then PR 1 the client (the palette, the trade colours, one helper for the three waiting buttons, the pins) and PR 2 the emails (the grey in two shared files, the copper in four more if call 3 is A, the pin's values edited by hand, the functions deployed after the merge).
size: S + S — PR 1 is portalTheme.ts, portalPayload.ts, unifiedJobBidSearch.ts, three button files and the pin test, plus the 23-file copper sweep under call 3 A; PR 2 is two to six shared email files and a deploy of eight functions (fourteen with the copper)
blocker: The owner's three calls.
opinion: your call — the trade colours and the copper are the portal's look; change only what fails, and keep each trade recognisable
mockup: safety-orange-and-portal-contrast-before-after.html
---

# The portal's last contrast flags (#199)

## The ask

The owner, 2026-10-27: *"add these two suggested tasks to the punchlist with a note to investigate
before we build"*. This is one of the two. Settings → **What everyone sees** (punch list #194)
found these while PR #6314 was checked. That PR took the homeowner's portal from 16 flagged texts to
2 by moving the paper palette's `FAINT` from `#8a97a6` to `#5e6d7c`. These are the 2 that remain,
plus the pairs next to them that the same look should settle.

## Investigate before we build

The owner asked for a look before any code. The investigation answers four questions. Each is
answered under **Investigated 2026-10-28** below.

1. **How should a disabled Tell us look?** The button waits until a date is picked, and until then
   it is white on `HAIR`. Find a disabled look whose word reads and that still looks unpressable.
2. **Which trade colours fail, and on which ground?** Measure `PORTAL_TRADE_COLORS` on `NOTE_BAND`,
   `CARD` and `PAPER`, and check whether the app's trade tags should move with them or stay apart.
3. **What about the copper?** As small text, `COPPER` `#b0662f` is under 4.5:1 everywhere.
4. **Which emails and functions change?**

## Investigated 2026-10-28

The mock-up beside this card, `safety-orange-and-portal-contrast-before-after.html`, draws every
spot below as Now beside each option on the portal's own paper, and computes every ratio in the
page from the colours drawn with the lens's own formula. The green-edged panel is the
recommendation.

### 1. A waiting Tell us

Three buttons on the portal share the pair `background: on ? COPPER : HAIR` with white words:
*Tell us* in `PortalPromiseAsk.tsx`, the GC page's *Send* in `PortalGcMessages.tsx` and the forms'
button in `PortalGcForms.tsx` (its `solid(on)` helper). One helper in `portalTheme.ts` settles all
three. WCAG exempts a disabled control from the 4.5:1 rule, but the lens flags anything under 3:1
and a customer may read a blank button as broken.

| Look | Pair | Ratio |
|---|---|---|
| Now | white on `HAIR` `#ddd6c8` | **1.45:1** |
| **A · muted words on the hairline** (recommended) | `MUTED` `#5a6b7e` on `HAIR` | 3.78:1, above the lens's floor; a waiting button is allowed under AA |
| B · an outlined copper button | `#9a5b2b` on `CARD` with a copper border | 5.24:1, but it reads as a second button, not a wait |
| C · ink words on the hairline | `INK` on `HAIR` | 10.36:1, but it reads as pressable |

The fill itself is 1.30:1 against the paper, so under every option the button stays quiet; only
the word changes.

### 2. The trade colours

`PORTAL_TRADE_COLORS` in `portalPayload.ts` copies `BID_SERVICE_TYPE_TAGS` in
`unifiedJobBidSearch.ts`, by design, so the portal bundle stays lean. On the paper they are words;
in the app they are fills under white words (the Bid Board, the Stages row chip, the clock's job
list, the bid form), and those fail the same way.

| Colour | On `NOTE_BAND` | On `PAPER` | On `CARD` | White on it (the app's pill) |
|---|---|---|---|---|
| PLUM `#e17235` | **2.68:1** | **2.85:1** | 3.07:1 | 3.15:1 |
| ELEC `#EE9310` | **2.02:1** | **2.15:1** | **2.32:1** | **2.38:1** |
| HVAC `#06b6d4` | **2.06:1** | **2.19:1** | **2.37:1** | **2.43:1** |

- **A · each trade a step darker along its own hue** (recommended): the lightest shade of each hue
  that reads 4.5:1 on the band, the darkest ground. PLUM `#af4f1a`, ELEC `#985e0a`, HVAC
  `#04768a`: 4.5:1 on the band, 4.8:1 on the paper, 5.2:1 on the card, and 5.3:1 with white, so the
  app's pills can share them. A burnt orange, an ochre and a teal, each still its trade. With A the
  second call is whether the two tables become one source (the app's pills lifted for free, the
  portal bundle importing three strings) or the portal's copy moves alone.
- **B · ink words, the colour as a dot beside them**: the word reads at 10:1 and the brand colour
  stays exact, but the band carries a dot the partner statement does not, and the app's pills stay
  as they are.
- A 3:1 shade (`#dd6421`, `#c1770d`, `#0595ae`) would clear the lens and fail AA; not drawn.

The sample portal has one plumbing job, so the lens showed PLUM alone; ELEC and HVAC are by number.

**Confirmed live 2026-10-28** on the dev server, Who, outside → Homeowner → Portal · Any time,
Across → Widths and themes: 375, 768 and 1280 each show the same 2 texts under 3:1, *Tell us* white
on `#ddd6c8` (1.45:1) and *PLUM* `#e17235` on `#f1ece2` (2.68:1). General contractor → their
schedule in their portal: 1 text at every width, *PLUM* (2.68:1); the GC's page carries no promise
ask. Every other homeowner page read Clean.

### 3. The copper

`COPPER` `#b0662f` carries words in 28 places on the portal pages (eyebrows at 10.5 px bold
uppercase, the headings *Agreements* and *Your payments*, the links *use a different number* and
*See the bills you share*, the payments' *why* line) and white words on 8 buttons (*Send request*,
*Request a bid*, *Tell us* once picked, the GC page's and the stage ask's sends). As dots, rules and
the brand mark's full stop it carries nothing.

| Pair | Now `#b0662f` | A `#9a5b2b` |
|---|---|---|
| Words on `NOTE_BAND` | 3.73:1 | 4.57:1 |
| Words on `PAPER` | 3.96:1 | 4.85:1 |
| Words on `CARD` | 4.28:1 | 5.24:1 |
| Words on white (the emails) | 4.39:1 | 5.38:1 |
| White on the copper (a button) | 4.39:1 | 5.38:1 |

- **A · one copper, a step darker** (recommended): `COPPER` becomes `#9a5b2b`, the same hue and
  saturation, and every word, button, dot and rule follows. One value in `portalTheme.ts` lifts the
  customer, pay, partner, sub and law firm pages. **Twenty-three more files copy `#b0662f` as a
  literal** and move in the same PR by a sweep, the way v2.5981's `FAINT` change moved the packets:
  six email builders in `supabase/functions/_shared/` (`legalEmails`, `contractSigningEmail`,
  `submittalReplyEmail`, `submittalRoomLinkEmail`, `stripeBillEmail`, `portalAccountCard`), the two
  legal print packets (`legalPacketPrint.ts`, `legalFirmPacketPrint.ts`), eleven app surfaces
  (`TestReportModal`, `TestReportPreview`, `TestReportSendSheet`, `JobFormAddressNudge`,
  `JobFormStagesDrawer`, `SubmittalAnswerDialog`, `SubmittalTheirCallPanel`, `SubmittalRoom`,
  `roomStyles`, `LegalDesk`, `LegalFirmWindow`, `FormBoxLayer`, `CustomerWaitingRequestCard`) and
  two tests (`contractSigningEmail.test.ts`, `gcStatementEmailParity.test.ts`).
- **B · a second copper for words**: a `COPPER_TEXT` at `#9a5b2b` for words, the fills at the old
  copper. The buttons stay at 4.39:1, a hair under AA, and two values have to be kept in step.
- **C · leave the uppercase eyebrows** (3.96:1, above the lens's floor) and fix the rest.

### 4. The emails and their functions: a go, not a call

The old grey `#8a97a6` is in two shared files: three footers in
`supabase/functions/_shared/legalEmails.ts` and `const faint` in
`supabase/functions/_shared/contractSigningEmail.ts`. On white it reads 2.98:1 and on the paper
the contract email sits on, 2.68:1. `#5e6d7c` reads 5.31:1 and 4.79:1 there. Eight functions import
the two files and deploy after the merge:

- `legalEmails`: `legal-notify-dispatch`, `legal-send-firm-link`, `submit-legal-portal`.
- `contractSigningEmail`: `accept-contract`, `complete-contract-form-office`,
  `contract-form-paper-entry`, `get-contract-for-signer`, `send-contract-for-signature`.

If call 3 is A, the copper moves in the four other builders too, and six more functions deploy:
`send-submittal-reply-email`, `send-submittal-room-link`, `send-stripe-invoice`,
`gc-statement-email-dispatch`, `send-gc-statement-email`, `send-lien-release-email`. `npm run
check:edge-drift` names what is behind after the merge.

**The pin is edited, never regenerated.** `src/lib/contractSigningSend.pin.json` holds the signing
email byte for byte so that what a person's email says, who it is from and where it replies cannot
move (`contractSigningSend.pin.test.ts`). A colour change edits the pinned HTML's `#8a97a6` values
(two per case) and, under call 3 A, its `#b0662f` ones, by hand, and nothing else in it changes;
the test then still proves the words did not move.

### The owner's three calls

| Call | Recommended | Also drawn |
|---|---|---|
| 1 · the trade tag | A · each a step darker, one source for the portal and the app's pills | A with the portal's copy alone · B · ink words and a dot |
| 2 · a waiting Tell us, Send and the forms' button | A · muted words on the hairline | B · outlined copper · C · ink words |
| 3 · the copper | A · one copper, a step darker, with the 23-file sweep | B · a second copper for words · C · leave the eyebrows |

## Where it plugs in

- `src/lib/portal/portalTheme.ts` holds the paper palette. `FAINT` is `#5e6d7c` since PR #6314.
- `src/lib/portal/portalPayload.ts` holds `PORTAL_TRADE_COLORS`, and `src/pages/CustomerPortal.tsx`
  draws the trade tag on the job band; `src/components/partner/PartnerStatementPaper.tsx` draws it
  on the partner statement from the app's table.
- `src/components/portal/PortalPromiseAsk.tsx`, `PortalGcMessages.tsx` and `PortalGcForms.tsx`
  hold the three waiting buttons.
- `src/lib/readablePairs.test.ts` (PR #6314) pins every paper text tier on every paper ground. Add
  the three trade colours on the band and with white, the copper on every ground and with white,
  and the waiting button at 3:1.

## Plan

1. The investigation and a before-and-after mock-up on made-up data, then the owner's pick.
   **Done 2026-10-28; the calls are above.**
2. A client PR for the waiting buttons, the trade colours and the copper, as picked, with the pins,
   a release note and a fragment.
3. An edge PR to move the emails' grey to `#5e6d7c` (and the copper, under call 3 A), the pin's
   values edited by hand. Deploy every importer after the merge (`supabase functions deploy <name>`;
   `create-user` keeps `verify_jwt = false`).

## How to verify

Sign in with `/dev-login?as=1` and open `/settings?tab=settings-what-everyone-sees`. Pick Who,
outside → **Homeowner**, then **General contractor**, then Every screen, then press **Check every
screen**. No portal page should show text under 3:1.

The list under *What the check found* shows only the first 6 items, so read the whole frame for the
full set. When the browser pane is hidden, CSS transitions freeze, so read colours after they
settle.
