---
name: "Tooling family: marks for the ten apps without one"
group: close
status: picked 2026-09-19 · rolled out 2026-09-20 — live on all ten app sites and on the sign-in page (v2.3626) · left: measure the eight new drawings, then delete the folder
summary: >
  Three apps ship the house mark (the yellow tile, dark ink): CountTooling, Takeoff Tooling and
  ClickTooling. The other ten Tooling apps carry a mismatched icon or none — three have no icon
  at all and GovTooling links one that 404s. Todd drew two candidates per app in the house style
  and graded them by measurement at tab size (thickness, ink share, centring, safe zone, what
  survives at 16px, closeness to the shipping marks). The working board beside this file shows
  each app's live icon next to its candidates at 48 / 32 / 16px on light and dark tab strips,
  with a pick per app and the family strip as browser tabs will show it.
next: >
  Measure the eight new drawings with the hand-off's studio (from a CountTooling checkout). If
  one warns and is redrawn, replace its file in `public/tooling/` here and re-run the icon
  generator in that app's repo. Then delete this folder.
size: S
blocker: None. The studio needs Playwright from a CountTooling checkout.
opinion: later — everything is live; measuring is a check on work already shipped, not a blocker.
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

## The rollout — 2026-09-20

Every app repo (`clickconstruction/<app>tooling.github.io`) took the four-file set the hand-off
suggested — `icons/favicon.svg`, `icons/icon.svg`, `icons/apple-touch-180.png` (full-bleed) and a
root `favicon.ico` (16 / 32 / 48) — with the same three head links on every page and no web
manifest. Each is PR #1 in its repo, merged and checked live (both files return 200 on all ten
domains). GovTooling's went in `public/` with absolute paths and fixed a tab icon that 404'd in
production. The sign-in page's ten *More apps* links carry the marks since v2.3626.

The PNG and ICO were rendered from the SVG with Chromium at exact pixel sizes by a small script
(`make-icons.cjs`, Playwright from this repo's `node_modules`) that lived in the session's
scratchpad; it is forty lines and easy to rewrite if a mark changes.

The same sitting cleaned up the apps themselves, one before/after at a time — each repo's PRs
carry the record: BidTooling (header, running total, fixture rows, pricing, Send), LienTooling
(shell, seven orphan pages removed, remembered business, the document beside the form),
PaperTooling (pages start kept; *Just these pages* beside *Shrink it*, after a 265 KB form came
out as 1.3 MB), PayTooling (every PDF date printed one day early; the form opened on April
2025), SignTooling (the five DocuSeal documents, said plainly), SubTooling (tap-to-add, any line
removable, a custom fixture printed as the word "custom"), GovTooling (shell, plus 31 tests on
the payroll math gating the deploy), and SyncTooling / ConnectTooling (invented testimonials
removed; a *now part of ClickTooling* card over the original site).

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
