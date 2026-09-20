---
name: "Tooling family: marks for the ten apps without one"
group: ready
status: all ten marks picked by the owner 2026-09-19 (`picks.json`) · eight are new drawings, not yet measured · nothing committed to any app repo
summary: >
  Three apps ship the house mark (the yellow tile, dark ink): CountTooling, Takeoff Tooling and
  ClickTooling. The other ten Tooling apps carry a mismatched icon or none — three have no icon
  at all and GovTooling links one that 404s. Todd drew two candidates per app in the house style
  and graded them by measurement at tab size (thickness, ink share, centring, safe zone, what
  survives at 16px, closeness to the shipping marks). The working board beside this file shows
  each app's live icon next to its candidates at 48 / 32 / 16px on light and dark tab strips,
  with a pick per app and the family strip as browser tabs will show it.
next: >
  Measure the eight new drawings with the hand-off's studio (from a CountTooling checkout) and
  fix what warns. Then the rollout: one PR per app repo, GovTooling last and alone (Plumbing
  Tooling retires ~2026-10-11 — the owner's call whether it gets one), and one PR here putting
  the marks on the sign-in page's More apps links.
size: M (ten small repo PRs + one here)
blocker: None. The studio needs Playwright from a CountTooling checkout.
opinion: build — the picks are made; measure, then it is eleven small PRs.
---

# Tooling family: marks for the ten apps without one

## The picks — 2026-09-19

Made in one sitting on the board, one app at a time; the owner's words are in `picks.json`.

| App | Pick | File | From |
|---|---|---|---|
| BidTooling | the price tag | `svg/bid-4-price-tag.svg` | new |
| Plumbing Tooling | refined | `svg/plumbing-2-refined.svg` | hand-off (warns: vsShipping 0.694) |
| LienTooling | refined | `svg/lien-2-refined.svg` | hand-off (warns: safeZone 49) |
| PaperTooling | the page with the download arrow cut out | `svg/paper-5-page-download.svg` | new — started over |
| PayTooling | the stub that is the road (mileage) | `svg/pay-5-stub-is-the-road.svg` | new |
| SubTooling | the roofline over the equals | `svg/sub-5-roofline-equals.svg` | new |
| SignTooling | X, then an *ST* signature joined at the top | `svg/sign-12-x-then-st.svg` | new |
| SyncTooling | the square cycle framing a three-bar Gantt | `svg/sync-5-square-cycle-gantt.svg` | new |
| ConnectTooling | phone, text and email joined in a triangle | `svg/connect-6-phone-text-email.svg` | new — redone |
| GovTooling | the courthouse with the certified seal on its corner | `svg/gov-6-courthouse-with-seal.svg` | new — redone |

The eight new drawings follow the hand-off's authoring rules (two colours, no `<text>`, no
opacity) but are **unmeasured**: thickness, ink share, centring, safe zone, 16px decay and
closeness to the three shipping marks have been judged by eye on the board only. Known soft
spots to look at first: ConnectTooling's three nodes blur together at 16px (the phone's home
dot and the bubble's typing dots are under a pixel); SignTooling's letters are drawn at 0.72
scale, so its strokes sit near the one-pixel floor; GovTooling's fourth column is mostly under
the seal. The unpicked candidates stay in `svg/` as the record of the sitting.

## What is here

- [`board.html`](./board.html) — **the working board**. Self-contained; rebuilt from the SVGs
  by `node to-dos/tooling-icons/build-board.mjs`. On the dev server it is
  `/to-dos/tooling-icons/board.html`. Picks and notes live in the browser (`localStorage`);
  *Copy picks + notes* hands them over as text.
- [`HANDOFF.md`](./HANDOFF.md) — Todd's hand-off, verbatim: the house style, the owner's
  round-one decisions, the grading method and its thresholds, the state per app, the repo
  survey and the suggested rollout. **Read it before drawing or rolling out.**
- `svg/<app>-<n>-<label>.svg` — the candidates. A new variant is a new file
  (`connect-3-handset.svg`) and a rebuild; it shows as *unmeasured* until the studio grades it.
- `current/` — each app's live icon, fetched from its repo on 2026-09-19 (six have one).
  `shipping/` — the three fixed marks, the calibration reference.
- `audit.json`, `verdicts.tsv` — the measured values behind the chips on the board.

The measurement studio is **not** in this folder: it borrows Playwright from Todd's
`counttooling.github.io` checkout (`/Users/todd/…`). It is in the hand-off zip
(`/Users/Shared/tooling-icons-handoff.zip` → `studio/`); re-measuring a new variant means
running it from a CountTooling checkout.

## The ten repos

All under `clickconstruction`, all public, all on `main`, all found 2026-09-19:
`bidtooling`, `plumbingtooling`, `lientooling`, `papertooling`, `paytooling`, `subtooling`,
`signtooling`, `synctooling`, `connecttooling`, `govtooling` (`<name>.github.io`). Icon links
confirmed from each `index.html`: bid / lien / paper `favicon.svg`; pay / sub the same plus a
duplicate `shortcut icon`; plumbing `img/favicon.svg`; sign / sync / connect none; gov links
`/favicon.svg`, which is not in the repo.

## Where this repo comes in

`src/lib/toolingFamily.ts` (`MORE_APPS`, v2.3624) lists the same ten as text-only links under
*More apps* on the sign-in page. Once marks are final they gain an `icon` each
(`public/tooling/<app>.svg`) — one PR, claimed version, release note and fragment.
**Plumbing Tooling** leaves that list when plumbingtooling.com retires
([`test-reports`](../test-reports/README.md), ~2026-10-11).
