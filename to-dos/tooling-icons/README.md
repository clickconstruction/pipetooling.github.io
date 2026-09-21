---
name: "Tooling family: marks for the ten apps without one"
group: close
status: picked 2026-09-19 · rolled out 2026-09-20 — live on all ten app sites and on the sign-in page (v2.3626) · **measured 2026-09-21** with the hand-off's studio (`measure.js`) — four of the eight new drawings clean, one warn, three fail, and the PaperTooling / PayTooling pair reads as twins at 16px · picked **Do** on the board 2026-09-21 · left: the redraws the owner takes, then delete the folder
summary: >
  Three apps ship the house mark (the yellow tile, dark ink): CountTooling, Takeoff Tooling and
  ClickTooling. The other ten Tooling apps carry a mismatched icon or none — three have no icon
  at all and GovTooling links one that 404s. Todd drew two candidates per app in the house style
  and graded them by measurement at tab size (thickness, ink share, centring, safe zone, what
  survives at 16px, closeness to the shipping marks). The working board beside this file shows
  each app's live icon next to its candidates at 48 / 32 / 16px on light and dark tab strips,
  with a pick per app and the family strip as browser tabs will show it.
next: >
  Redraw what failed (*Measured — 2026-09-21*): ConnectTooling, GovTooling, SyncTooling, and one of
  PaperTooling / PayTooling so the pair separates. A redraw is a new `svg/<app>-<n>-<label>.svg`,
  `measure.js` (from the unzipped studio), `build-board.mjs`, the owner's pick on the board; then
  the four-file set in that app's repo and its `public/tooling/<app>.svg` here. Then delete this folder.
size: S per redraw
blocker: None. The studio runs from this repo's node_modules (`measure.js` says how).
opinion: build — the measurement found what the eye missed: two marks that are the same silhouette at tab size, and three that decay to a blob; each redraw is one file and one rollout PR.
---

# Tooling family: marks for the ten apps without one

## The picks — 2026-09-19

Made in one sitting on the board, one app at a time; the owner's words are in `picks.json`.

| App | Pick | File | From |
|---|---|---|---|
| BidTooling | the price tag | `svg/bid-4-price-tag.svg` | new · **pass** |
| Plumbing Tooling | refined | `svg/plumbing-2-refined.svg` | hand-off · warn (vsShipping 0.694) |
| LienTooling | refined | `svg/lien-2-refined.svg` | hand-off · warn (safeZone 49) |
| PaperTooling | the page with the download arrow cut out | `svg/paper-5-page-download.svg` | new — started over · pass alone, **fails the pair** with PayTooling |
| PayTooling | the stub that is the road (mileage) | `svg/pay-5-stub-is-the-road.svg` | new · pass alone, **fails the pair** with PaperTooling |
| SubTooling | the roofline over the equals | `svg/sub-5-roofline-equals.svg` | new · **pass** |
| SignTooling | X, then an *ST* signature joined at the top | `svg/sign-12-x-then-st.svg` | new · warn (decay 1) |
| SyncTooling | the square cycle framing a three-bar Gantt | `svg/sync-5-square-cycle-gantt.svg` | new · **fail** (decay 2) |
| ConnectTooling | phone, text and email joined in a triangle | `svg/connect-6-phone-text-email.svg` | new — redone · **fail** (minFeature, counters, decay 9) |
| GovTooling | the courthouse with the certified seal on its corner | `svg/gov-6-courthouse-with-seal.svg` | new — redone · **fail** (decay 5) |

The unpicked candidates stay in `svg/` as the record of the sitting.

## Measured — 2026-09-21

Every candidate in `svg/` went through the hand-off's studio (`measure.js`, run from this repo;
`audit.json` and `verdicts.tsv` are that pass, and the board's chips read from it). The adapter
reproduces the hand-off's own numbers on the marks it had measured (LienTooling refined safeZone
49, Plumbing refined vsShipping 0.694), so the new values are on the same scale. Thresholds are
the studio's, frozen.

| Mark | Verdict | What the studio saw |
|---|---|---|
| bid-4 · paper-5 · pay-5 · sub-5 | pass | clean on all six measures; each at least 0.4 from every shipping mark |
| sign-12 | warn | decay 1 — the X and the *ST* fuse into one part at 16px; strokes measure 1.25px, above the floor |
| sync-5 | **fail** | decay 2 — five parts become three at 16px (the bars merge into the arrows); 16% of the ink outside the 80% circle |
| gov-6 | **fail** | decay 5 — seven parts become two, and new counters appear (the columns fuse, the seal's check closes); counter floor 0.75px; 14% outside the circle |
| connect-6 | **fail** | the weakest, as the hand-off predicted: thinnest feature 0.5px, counters 0.5px, decay 9 — six parts become one blob at 16px |
| **paper-5 ↔ pay-5** | **fail (pair)** | IoU 0.713, correlation 0.839 at 16px — above the pair the hand-off caught by eye (0.856) and its shipped twins (0.703): a tall rounded block with a vertical feature, twice. One of the two has to change shape, not detail |
| bid-4 ↔ pay-5 | warn (pair) | IoU 0.516, corr 0.702 — separates if PayTooling changes |

What the eye had flagged was right (Connect's dots, Gov's columns under the seal) and incomplete:
the Sign strokes are fine, and the pair collision was not visible on the board because the two
marks never sit side by side there.

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
- `audit.json`, `verdicts.tsv` — the measured values behind the chips on the board (the 2026-09-21
  pass, every candidate).
- [`measure.js`](./measure.js) — grades every candidate with the studio; its header says how to
  run it from this repo.

The measurement studio is **not** in this folder: it is in the hand-off zip
(`/Users/Shared/tooling-icons-handoff.zip` → `studio/`). `measure.js` runs it from this repo's
own `node_modules` (Playwright is here); no CountTooling checkout is needed.

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
