# Tooling app icons — handoff

**Status:** design phase, unfinished. Ten app marks are drawn and measured. Nothing has been
committed to any repository and no pull request exists. The next person needs to make final
picks for a few apps and then do the rollout described at the end.

**Owner:** Robert Douglas / Click Construction. Date of handoff: 2026-09-20.

---

## 1. What this is

Three apps already ship a house mark: **CountTooling**, **Takeoff Tooling** and **ClickTooling**
(the app at clicktooling.com, repo `pipetooling.github.io`). Ten more Tooling apps have either a
mismatched icon or none at all. This work designs marks for those ten in the same house style.

The three shipping marks are **fixed**. Do not redraw them. They are the calibration reference for
everything below.

---

## 2. The house style

All geometry on a **512 × 512 viewBox**.

| Element | Value |
|---|---|
| Tile | `<rect width="512" height="512" rx="112" fill="#e8c547"/>` |
| Ink | `#161617` |
| Bleed variant | same tile with no `rx` (for maskable / apple-touch icons, which the OS rounds) |
| Safe zone | keep the glyph inside the central ~80% |

A mark is authored as **inner markup only** (no `<svg>` wrapper, no tile). The tile is composed
around it. This is the same contract `counttooling.github.io/scripts/lib/brand-mark.js` already uses,
so a finished mark can be pasted into a real generator with no translation.

**Authoring rules, enforced by a lint before anything is measured:**
- No `<text>`. Outline letterforms. Font substitution is the biggest cross-machine variable.
- No `<image>`, `<filter>`, or external `href`.
- No opacity below 1.
- Exactly two colours, `#161617` and `#e8c547`. The whole measurement pipeline models every pixel
  as a blend of those two; a third colour silently corrupts every number.

---

## 3. Decisions already made by the owner

Round one offered four concepts per app. The owner picked:

| App | Decision |
|---|---|
| BidTooling | **BID1**, the clipboard with a total bar. Taken outright. |
| Plumbing Tooling | Combine **PLB1** (gauge with stem) and **PLB4** (pipe run with a gauge tee). |
| LienTooling | **LIEN1**, the gavel. Taken outright. |
| PaperTooling | Combine **PAPER1** (download arrow + tray) and **PAPER3** (arrows squeezing in). |
| PayTooling | Combine **PAY1** (dollar) and **PAY3** (torn stub). |
| SubTooling | Combine **SUB2** (house with a value bar) and **SUB3** (equals with a count dot). |
| SignTooling | **SIGN2** (signature on a rule), revised. |
| SyncTooling | Combine **SYNC1** (circular arrows) and **SYNC2** (stacked task bars). |
| ConnectTooling | Combine **CONN3** (nodes and links) and **CONN4** (two-way radio). |
| GovTooling | Combine **GOV3** (payroll table) and **GOV2** (stamped seal). |

Round two drew three variants of each combination. Round three took the leading variant for each
app and paired it with a refinement answering one specific criticism. **That is where things stand.**

---

## 4. Current state, per app

Each app has two candidates in `svg/`: `<app>-1-as-chosen.svg` and `<app>-2-refined.svg`.
Full measured values are in `audit.json`; a flat summary is in `verdicts.tsv`.

| App | As chosen | Refined | Recommendation |
|---|---|---|---|
| bid | pass | pass | **Open.** Both clean. Refined has a bigger clip so the clipboard silhouette survives 16px. |
| plumbing | warn: centring 52.3, safeZone 52, decay 1 | warn: vsShipping 0.694 | **Keep as-chosen.** The refinement fixed all three complaints but moved the mark closer to Takeoff Tooling. Neither is satisfying; this is the weakest row. |
| lien | warn: decay 1 | warn: safeZone 49 | **Take refined.** It fixes the real defect (handle fusing with the block at 16px) and trades it for a cosmetic one. |
| paper | warn: safeZone 45, decay 1 | warn: safeZone 44 | **Take refined.** Chevron and head now 52 units apart instead of 22, so they stop merging. |
| pay | warn: decay 1 | **pass** | **Take refined.** Deeper tear teeth, 40 units instead of 32. |
| sub | warn: minFeature 0.75 | **pass** | **Take refined.** Blunt roof apex removed the taper. |
| sign | pass | pass | **Open.** Both clean. Pick by eye. |
| sync | pass | pass | **Open, lean refined.** Two bars say "tasks", one bar reads as a pause button. |
| connect | warn: minFeature 0.75, inkShare 0.1732, decay 2 | warn: minFeature 0.75 | **Take refined**, but this mark is still the weakest of the ten and deserves another pass. |
| gov | warn: minFeature 0.75, decay 1 | warn: decay 1 | **Take refined.** Even 40-unit bands between rows. The seal still detaches at 16px. |

Totals across the 20 candidates: **8 pass, 12 warn, 0 fail.**

---

## 5. How the marks are graded

This is the part worth preserving. Every mark is rendered once at **1536 × 1536** (512 × 3, which
divides evenly by 16, 32 and 48) and then box-downsampled to exact integer sizes, so no resampling
error enters the numbers. Ink coverage per pixel is recovered by projecting the pixel colour onto
the yellow-to-dark line and multiplying by alpha, giving a continuous 0–1 value. A sub-pixel stroke
therefore shows up as a low ridge instead of vanishing.

### The six per-mark measures

| Metric | What it computes | Thresholds |
|---|---|---|
| **minFeature** | Thickness by morphological opening: the largest radius at which 90% of the ink survives. Reported as device pixels at a 16px render. | pass ≥ 1.00, warn ≥ 0.70 |
| **counterFloor** | The same, on enclosed gaps. Open notches are exempt. | pass ≥ 0.90, warn ≥ 0.60 |
| **inkShare** | Ink as a fraction of the rounded tile's area. Scale-free. | pass 0.18–0.33, fail outside 0.15–0.36 |
| **centring** | Ink centroid versus tile centre, in 512-units. bbox offset reported as a note. | pass ≤ 40, warn ≤ 55 |
| **safeZone** | Smallest margin from the ink's bounding box to the tile edge. | fail under 25.6 units (5%); warn if more than 12% of ink sits outside the 80% maskable circle |
| **decay** | Connected parts and enclosed counters at 512 versus at 16. Parts smaller than 1024 square units are ignored, because one pixel at 16px *is* 1024 units and anything smaller cannot survive at any size. | fail on 2+ parts lost or a 3-to-1 collapse; warn on any loss |

### The pairwise measure

Every mark is compared with every other, **including the three shipping marks**. A collision needs
**both** the same footprint and the same shape:

- **IoU** — soft intersection-over-union on the 16×16 coverage map.
- **corr** — Pearson correlation of the two coverage maps, mean-centred.
- Both are evaluated against the other mark plus its horizontal flip, vertical flip and 180° rotation.

Gate: **fail** at IoU ≥ 0.55 **and** corr ≥ 0.70. **warn** at IoU ≥ 0.50 **and** corr ≥ 0.62.

Only a clash with one of the three *shipping* marks disqualifies a concept. Two apps' unchosen
concepts never appear together, so concept-versus-concept closeness is reported, not treated as a defect.

### Why those numbers

Measured, not guessed:

| Pair class | IoU | corr |
|---|---|---|
| Genuinely distinct (3 shipping pairs + 2 obvious controls) | 0.349, 0.350, 0.435, 0.461, 0.480 | up to 0.654 |
| Two marks shipped as accidental twins (a known defect) | **0.557** | **0.703** |
| A pair caught by eye as too similar | **0.680** | **0.856** |

The gate sits between the distinct group and the twins.

Calibration values for the three shipping marks (all pass):

| Mark | minFeature | inkShare | centring | safeZone |
|---|---|---|---|---|
| CountTooling | 1.50 | 0.2152 | 33.5 | 34 |
| Takeoff Tooling | 1.00 | 0.2472 | 33.7 | 47 |
| ClickTooling | 1.75 | 0.2785 | 10.1 | 60 |

**Thresholds are frozen.** They were derived from the shipping marks and must not be re-tuned from a
batch of new concepts, or a weak batch quietly lowers the bar. If a shipping mark ever fails, the
threshold is wrong or the failure is accepted debt; write it down either way.

### Two perceptual metrics that did not work, and why

Recorded so nobody wastes time re-deriving them:

1. **Perceptual hash (pHash).** No separation at all on two-colour icons. The twins scored 22 while
   genuinely distinct pairs scored 24 to 36. It is computed and reported for information but never gates.
2. **Residual correlation** (subtracting the corpus mean before comparing). It over-corrects. It ranked
   the known twins 87th out of 990 pairs, because those two marks were confusable precisely for being
   *generic*, and subtracting the family mean removes exactly the generic part. Do not use it.

---

## 6. Accepted debt on the shipping marks

- **Takeoff Tooling** has ruler tick notches 22 units wide, 0.69px at 16. They vanish at tab size.
  This is deliberate and already encoded upstream as `DETAIL_MIN_PX = 64` in its generator.
- **CountTooling**'s round tick caps reach to 34 units from the tile edge, so a 10% launcher crop
  would clip them. Its maskable icon ships that way today.
- **Takeoff Tooling** puts about 10.6% of its ink outside the 80% maskable circle, for the same reason.

These are why `safeZone` warns on the circle rather than failing.

---

## 7. What is NOT done

**The rollout.** No repository has been touched. Findings from a survey on 2026-09-19:

- The ten repos are `<name>.github.io` under the GitHub org `clickconstruction`:
  bidtooling, plumbingtooling, lientooling, papertooling, paytooling, subtooling,
  signtooling, synctooling, connecttooling, govtooling.
- **Only two are cloned locally**: `plumbingtooling.github.io` and `govtooling.github.io`. The other
  eight are remote-only and total about 411 KB, so cloning all of them takes seconds.
- Nine are plain static sites publishing from `main` root with **no CI gate**, so a bad commit is
  live in about a minute. None has branch protection. Use pull requests anyway.
- **Three have no icon at all**: signtooling, synctooling, connecttooling.
- **lientooling is the fan-out case**: nine hand-written HTML files each carry the same icon link at
  line 7, and four more pages have none.
- **plumbingtooling, paytooling and subtooling** each emit a duplicate legacy `rel="shortcut icon"`
  alongside `rel="icon"`.
- **plumbingtooling** keeps its icon at `img/favicon.svg`, not the repo root. Its `img/logo.svg`,
  `logo-wide.png` and `logo-tall.png` are the **Click Plumbing company letterhead**, printed on
  customer test reports. Do not touch them or their call sites.
- **govtooling is the odd one.** Vite 7 + React, multi-entry build, deploys through a GitHub Actions
  workflow. `index.html:5` links `/favicon.svg` and **that file does not exist**, so the link 404s in
  production today. Assets must go in `public/` (Vite copies it verbatim) and paths must stay absolute.
  `dev.html` and `generator.html` have no icon link at all. Do this repo last and alone.
- No repo of the ten has a web manifest, a service worker, an `.ico` or any PNG icon.

**Suggested asset set per repo** (four files, not the seven the shipping repos carry, because with no
manifest nothing would ever request the 192/512/maskable PNGs):
`icons/icon.svg`, `icons/favicon.svg`, `icons/apple-touch-180.png`, and a root `favicon.ico`.

**Suggested head block** (relative paths for the nine static repos; absolute for govtooling):

```html
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-180.png">
```

**Do not** add a web manifest as a side effect of an icon change. `display: standalone` changes how
the app launches on Android and is a separate product decision.

**Follow-on.** ClickTooling's sign-in page lists these ten apps as text-only links under a "More apps"
disclosure (`src/lib/toolingFamily.ts`, shipped as v2.3624). Once the marks exist they can gain icons
there. That repo needs a claimed version number, a release-note and docs-fragment pair, and a merge
queue merge, so do it as **one** pull request for all ten, not ten.

---

## 8. Reproducing the measurements

The studio is throwaway tooling, included here in `studio/`. It is plain CommonJS with one
dependency, `@playwright/test`, which it borrows from an existing checkout rather than installing.

```bash
cd /Users/todd/Documents/GitHub/counttooling.github.io
export NODE_PATH=$PWD/node_modules
node <studio>/calibrate.js    # measure the three shipping marks
node <studio>/regression.js   # MUST fail the planted twins, exit 0
node <studio>/audit.js        # score every concept, write audit.json + svg/
node <studio>/select.js       # brute-force the best one-per-app combination
node <studio>/delta.js        # before/after table for as-chosen vs refined
node <studio>/sheet.js        # build matrix.html
node <studio>/overview.js     # build overview.png
```

| File | Purpose |
|---|---|
| `studio/spec.js` | Palette, tile, and every threshold, with calibration notes |
| `studio/lib.js` | Tile composition, lint, Chromium render, coverage, distance transform, components, correlation |
| `studio/metrics.js` | The six per-mark measures |
| `studio/draw.js` | Drawing primitives |
| `studio/concepts.js` | The current candidates. Earlier rounds preserved as `concepts.round1.js` and `concepts.round2.js` |
| `studio/regression.js` | The twin-detection test. Run it after any change to the pairwise metric. |

**Run `regression.js` before trusting any change to the grading.** It plants two marks that were
genuinely shipped as accidental twins and asserts the gate fails them. It caught a bad threshold once
already.

---

## 9. Honest assessment of where this landed

- The measurement caught things eyeballing did not: two marks that were the same silhouette at tab
  size, a mark that collided with ClickTooling's gear, and a refinement of mine that measured worse
  than the thing it was meant to improve.
- Of ten refinements drawn in round three, **two clearly beat the original, seven were level, and one
  was worse** until corrected. That ratio is worth knowing before spending another round.
- **ConnectTooling is the weakest mark** and would benefit most from fresh eyes. The radio-with-waves
  idea has never measured well.
- **Plumbing Tooling is unresolved.** Every attempt to balance it pushes it toward Takeoff Tooling.
  A different metaphor may be the answer rather than another adjustment.
- Three apps (bid, sign, sync) have two clean options each. Those are taste, not measurement.

---

## 10. Package contents

| Path | What |
|---|---|
| `HANDOFF.md` | This document |
| `overview.png` | Every candidate with its verdict, as chosen versus refined |
| `matrix.html` | Interactive sheet: radio per app, size ladders on light and dark tab strips, audit values per card |
| `svg/` | 20 SVGs, `<app>-1-as-chosen.svg` and `<app>-2-refined.svg` |
| `audit.json` | Every measured value, every threshold, every flagged pair |
| `verdicts.tsv` | Flat summary, one row per candidate |
| `studio/` | The measurement tooling |
