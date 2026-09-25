# Sub Portal Architecture Map

---
file: docs/SUB_PORTAL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the public subcontractor portal (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what src/pages/SubPortal.tsx (1,563 lines, 7 in-file components + 1 hook) owns (state, handlers, the two edge functions it talks to, the capability-link auth model, sub-components, coupling, test coverage) so extraction can start without re-deriving it. Sections: What this surface is; Master summary table; Per-region dossiers; Shared substrate; Stage-A inventory; Test coverage; Recommended extraction order; Hazards.
covers:
  - src/pages/SubPortal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are exact as of `a05cef4c4`** (from the `npm run map -- src/pages/SubPortal.tsx` fact sheet; the file is byte-identical at `db92699d2`) and rot with the next edit — **search the symbol**; the range is only a hint.

## What this surface is

The no-login **"Work & pay statement"** a subcontractor opens from a minted capability link — the customer portal's person-keyed sibling. The sub sees their open sheets (line items, Agreed · Paid · Open, a four-dot stage rail), the 90-day payment ledger, paperwork status, "Your days", and can **act**: report percent done, say "my work here is done", move their picked dates, sign-to-accept / decline / "can't do those days" on work offers, open a signing page for unsigned paperwork, and mark days off. Bilingual EN/ES toggle, print-ready (Print = the PDF path), single-theme light.

| Fact | Value |
|---|---|
| Routes | `/sub?t=<token>` and `/s/:slug` (both → `SubPortal`, public, no `ProtectedRoute`) — `src/App.tsx:228`, `:230` |
| Imported by | `src/App.tsx` (static import `:51`, not `lazy`), `src/pages/SubPortal.render.test.tsx` |
| Props / parent contract | none — the page reads only the URL: `t` (token), `:slug` (lower-cased), `demo=1` (**DEV only**, renders `SUB_PORTAL_DEMO_PAYLOAD`), `preview=1` (`PUBLIC_PREVIEW_PARAM` — office preview, not counted as a view), `focus=sheet:<id>\|offer:<id>` (office "Show me on their portal") |
| Hook census (whole file) | **29 `useState`** · 0 `useReducer` · **3 effects** · **3 `useMemo`** · 0 `useCallback` · **1 `useRef`** · 4 custom hook calls (`useSearchParams`, `useParams`, `useSubPortalFocusPulse` ×2) |
| Per component | `SubPortal` 2 state / 2 effects / 1 memo · `SubPortalStatement` 1 / 0 / 1 · `SheetCard` **15** / 0 / 0 · `OfferCard` **8** / 0 / 1 · `DocRow` 2 · `useSubPortalFocusPulse` 1 state / 1 ref / 1 effect |
| Monster blocks | `SheetCard` 684–1118 (**435**, render 854–1117 = 264) · `SubPortalStatement` 325–650 (**326**, render 349–649 = 301) · `OfferCard` 1130–1450 (**321**, render 1252–1449 = 198) · `SubPortal` shell 129–297 (169) |
| Supabase client calls | **none** (the fact sheet's `tables — · rpcs — · edge fns —` is literal: every read/write is a raw `fetch`). The only `supabase` touch is `supabase.auth.getSession()` inside `staffAwarePublicHeaders` |
| Churn | 15 commits / 90 days (last `ef02b9b90`, 2026-09-20, v2.3636) — hot; every sub-portal train PR edits this file |

### Auth model and data channels

| Channel | Where | Method / headers | Server | Auth |
|---|---|---|---|---|
| **Read** statement | `SubPortal` load effect 150–187 | `GET /functions/v1/sub-portal?token=…\|slug=…[&preview=1]`; headers = `publicFunctionHeaders(sample)` (anon key) for a sample token, else `staffAwarePublicHeaders()` (the office session's bearer when one exists, else anon) | `supabase/functions/sub-portal/index.ts` (411 lines, `verify_jwt = false` in `config.toml:781`) — service-role client; token → `sub_portal_links` (raw `token`, then sha256 `token_hash`; `revoked_at` → 404), slug → `sub_portal_slugs` (first open locks it, `sub_portal_slug_events`); logs every validated load to `public_page_views`, stamped outside / staff / preview (only outside counts); payload built by `_shared/subPortalStatement.ts` | **the link is the capability**; the bearer is only a "who is looking" hint for view counting |
| **Write** (8 kinds) | 6 hand-rolled `fetch` sites (table below) | `POST /functions/v1/submit-sub-portal`, **only `Content-Type`** — no `apikey`/`Authorization` | `supabase/functions/submit-sub-portal/index.ts` (686 lines, `verify_jwt = false` `config.toml:791`) — service-role; `resolveLink` (raw token, then hash; revoked → refused); every kind re-scopes to `link.person_id` | body `token: submitToken` |
| Sign paperwork | `DocRow.openSigningPage` 1490–1515 | `sign_link` POST, then `window.location.href = json.signPath` | mints a `/contract/accept` token | navigates to `ContractAccept` |

`submitToken` (189) = `payload.requestToken ?? token` — the read function returns the link's raw `token` (`sub-portal/index.ts:403`) so a **slug**-opened page can write. RLS never applies (both functions are service-role); all scoping is in-function.

**Write kinds this page sends** (`availability` exists server-side but the page no longer sends it — form dropped v2.2766):

| `kind` | Sender (symbol, lines) | Body beyond `token` | Server effect (submit-sub-portal) |
|---|---|---|---|
| `day_off` | `SubPortalStatement` inline `onToggleOff` 623–637 | `day, off` | `person_availability` upsert/delete; past days refused |
| `progress` | `SheetCard.sendProgress` 720–753 | `laborJobId, pct?, note` | `people_labor_jobs` progress, `project_workflow_steps.percent_complete`, `job_activity_events` |
| `pick_dates` | `SheetCard.moveDates` 760–790 | `commitmentId, pickedStart, pickedEnd` | `step_commitments` pick (`evaluatePick`/`canChangePick`), sheet `job_date`, step schedule |
| `mark_work_done` | `SheetCard.markWorkDone` 819–850 | `laborJobId, note` | sheet stage working → walkthrough (source `portal`), dispatch note; returns `stageChangedOn` |
| `accept_offer` | `OfferCard.submitAccept` 1198–1226 via `post` 1181–1196 | `commitmentId, printedName, agreedTerms: true, acknowledgements, pickedStart?, pickedEnd?, signaturePngBase64?, esignConsent?` | offered → accepted, signature stamp + ESIGN consent, `create_sheet_for_work_order` RPC, dispatch note |
| `cant_do_dates` | `OfferCard.submitCantDo` 1228–1237 | `commitmentId, note` | dispatch ask-back (rate-limited per link per hour) |
| `decline_offer` | `OfferCard.submitDecline` 1239–1250 | `commitmentId, reason` | offered → declined + dispatch note |
| `sign_link` | `DocRow.openSigningPage` 1490–1515 | `documentId` | mints a signing token for the sub's own unsigned `person_contract_documents` row; returns `signPath` |

---

## Master summary table

| Region | Anchor (symbol + lines) | ~Lines | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|
| Module scaffolding | `supabaseUrl` 48, `PageState` 50–53, `sectionHeadStyle`…`cardStyle` 55–78, `money` 80–82, `type T` 323 | ~40 | read by every component | low | `formatPortalUsd` tested (`portalPayload.test.ts`) | inline |
| `ReferencesBlock` | 85–127 | 43 | used by `SheetCard` 1006 + `OfferCard` 1274 | low | not asserted | inline (presentational) |
| Shell: URL + load + chrome | `SubPortal` 129–297 (load effect 150–187, `<style>` 202–229) | 169 | owns URL params, `lang`, `state`, `submitToken`; parent of all | med (auth headers, deep links) | render smoke (happy / focus / dead link) | inline — **stays** |
| `PrintPageHeader` | 299–321 | 23 | payload + `t` | low | none | inline (presentational) |
| Statement head + pay split | `SubPortalStatement` 338–378 (`queuedNow` memo 341–346, `laterAmount` 347) | ~40 | payload | **money** | total asserted; **split not** | inline — Stage A |
| Print button + pay explainer | 380–410 | ~30 | none | low | none | inline |
| Jobs + Offers lists | 412–445 | ~34 | maps to `SheetCard` / `OfferCard` with `focus` | low | via cards | inline — stays with composition |
| Payments ledger + recap | 447–569 (conditional 454–530 = 77) | 123 | payload only | low-med (money display) | memo, minus note, "Balance owed" asserted; trace rows not | inline → Stage B |
| Paperwork + QR short-address | 571–613 | 43 | `DocRow`, `payload.slug`, `QRCodeSVG` | low | MSA / expiry / Sign now / slug asserted | inline |
| Your days + `day_off` write | 615–640 (inline POST 623–637) | 26 | `SubPortalYourDays`, `submitToken` | med (write) | component test w/ mocked `onToggleOff`; page POST none | partially extracted → `src/components/subPortal/SubPortalYourDays.tsx` |
| Guide + footer | `guideOpen` 340; 642–647 | ~8 | `SubPortalGuideButton`/`Sheet` | low | `subPortalGuideStrings.test.ts` | extracted → `src/components/subPortal/SubPortalGuide.tsx` |
| Focus pulse hook | `useSubPortalFocusPulse` 659–676 | 18 | both cards; DOM-id contract with office `SheetStoryModal` | low-med | render smoke case 2 | inline |
| Sheet status words | `SheetCard` 792–817 (`payWhenParts`, `queued`, `stageIndex`, `chip`, `sentence`) | 26 | local `stage`/`stageSource`/`stageChangedOn` | low | walkthrough sentence + payable-after asserted | inline — Stage A (rail kernel already extracted) |
| Sheet dates panel | state 756–758, `moveDates` 760–790, render 891–941 | ~85 | reads `stage` (914) | med (write) | none (picker math in `subPick.test.ts`) | partially extracted (`SubPortalDatePicker`, `pickEndFromStart`) |
| Sheet money rows | items 942–957, Agreed/Paid/Open 958–973 | 32 | `sheet` props | **money** (Paid = `paid + backcharges`) | items asserted; figures not | inline |
| Sheet rail + agreement | 975–1017 (focus wrapper opens 977, closes 1114) | ~43 | `stageIndex`, work-done `ui` (987), `ReferencesBlock` | low | via sentence | inline |
| Sheet progress control | state 709–714, derived 715–718, `sendProgress` 720–753, render 1019–1076 | ~100 | shares `note`/`ui`/`pend` with work-done; gated on `stage` (1019) | med (write) | header + "100% ✓" asserted; send never clicked | inline |
| Sheet work-done confirm | state 702–707, `markWorkDone` 819–850, render 1077–1113 | ~75 | `stage`, `ui`, `note`, `pend` | med (write) | none | inline |
| Offer gate + disclosure | `OfferCard` 1154–1179 (`allTicked`, `pickEnd`, `pickOk`, `disclosure`, `msaLine`) | 26 | offer + `payload.documents` | **high (e-sign)** | none | inline — Stage A |
| Offer writes | `post` 1181–1196, `submitAccept` 1198–1226, `submitCantDo` 1228–1237, `submitDecline` 1239–1250 | 70 | `ui` state machine | **high (e-sign)** | none | inline |
| Offer render | 1252–1449 | 198 | `ContractAcceptSignatureForm`, `SubPortalDatePicker`, `ReferencesBlock` | med | title + "Sign to accept" asserted | partially extracted (signature form) |
| `DocRow` | 1452–1562 | 111 | props only | low-med (redirect) | static text asserted | inline → **first Stage-B move** |

---

## Per-region dossiers

### Module scaffolding — `supabaseUrl` 48 … `money` 80–82, `type T` 323
- **Contents:** `PageState` union (`loading` / `error` / `ready{payload}`), four `CSSProperties` consts shared by the statement and cards, `money = formatPortalUsd`, `T` (the translator signature) — **duplicated** as `type T` in `src/components/subPortal/SubPortalYourDays.tsx:13`.
- **Approach:** style consts → `src/components/subPortal/subPortalStyles.ts` before any card moves; export `SubPortalT` from `subPortalI18n.ts` and delete both local `T`s; inline `money` away (it is a pure alias).

### `ReferencesBlock` — 85–127
- **Render:** inside `SheetCard`'s agreement `<details>` (1006) and under `OfferCard`'s lines (1274, with `bond` + `specialProvisions`). Returns `null` when empty.
- **State / data:** none. **Tests:** no assertion. **Risk:** low.
- **Approach:** move verbatim to `src/components/subPortal/SubPortalReferencesBlock.tsx` in the same PR as the styles file (both cards need it).

### Shell — `SubPortal` 129–297 (stays)
- **URL parse 130–140:** `token` (`t`), `slug` (path, trimmed + lower-cased), `demoMode` (`import.meta.env.DEV && demo=1`), `sample = sampleStateFromToken(token)` (a string union or `null` — stable dep), `preview`, `focus` memo (`parseSubPortalFocus`).
- **Owned state:** `lang` 141 (EN/ES; effect 146–148 sets `document.documentElement.lang`), `state` 142.
- **Load effect 150–187** deps `[token, slug, demoMode, sample, preview]`: demo short-circuit → missing-key error (English literal 157) → fetch → `parseSubPortalPayload` → error message from `body.error` or English fallbacks (173, 180); `cancelled` guard.
- **Render 191–296:** `data-theme="light"` root; the **inline `<style>` 202–229** holds print rules *and* the `.sp-rail`/`.sp-st` rail CSS *and* `.sp-focus` halo keyframes — the cards depend on it; lang toggle 231–249; `SampleModeBanner` 251; letterhead 252–276; loading/error/ready 278–293.
- **Tests:** `SubPortal.render.test.tsx` (3 cases). Uncovered: missing-key, network catch, `/s/:slug`, lang toggle, sample banner, demo.
- **Approach:** stays. Optional Stage A: `subPortalLoadUrl({token, slug, preview})` + `subPortalLoadError(body)` (lines 162, 169–174).

### `PrintPageHeader` — 299–321
- `data-print-only` running header for the Payments and Paperwork print pages (449, 573). Presentational; moves with the ledger or to the styles/parts file.

### `SubPortalStatement` — 325–650 (the composition; stays in the page)
- **Props:** `payload, lang, t, submitToken, focus`. **Owned:** `guideOpen` 340. **Memo:** `queuedNow` 341–346.
- **Head + pay split 338–378 (money):** `payRunDayLabel = formatPayRunDay(...)`; `queuedNow` = Σ `open` of sheets with `open > 0` and `payableAfter <= payRun.nextRun` (YMD string compare); `laterAmount = max(0, totals.open − queuedNow)`. Big figure = server `totals.open`. The "later" words at 374 are an EN/ES ternary outside `subPortalT`. **Untested** — the fixture yields queued $1,620 / later $2,560 but the smoke asserts neither.
- **Print button + pay explainer 380–410:** `window.print()`; `payRun.explainer` band.
- **Jobs 412–432 / Offers 434–445:** map to cards with `focused={isSubPortalFocused(focus, kind, id)}`; offers are wrapped `data-screen-only` (a stale printed offer is a liability).
- **Payments ledger 447–569:** trace rows (crossed out, `data-testid="sub-portal-payment-trace"`, 483–494) then payment rows (495–519); negative amounts render `−$x` (payment rows in `PAPER_RED`; trace rows stay `FAINT`, struck through) — the signed-amount expression is **duplicated** at 491 and 516; recap card 531–568 (`totals.earned` / `totals.paid` / `totals.open`, no client arithmetic). → Stage B `SubPortalLedger.tsx` (~125, props `payload, lang, t`).
- **Paperwork 571–613:** `DocRow` per document; QR card (`portalShortUrl(payload.slug)`) prints on purpose — the paper → phone bridge.
- **Your days 615–640:** `SubPortalYourDays` (extracted); the `onToggleOff` closure 623–637 is one of the six hand-rolled POSTs (sample short-circuit 624).
- **Guide 642–647:** extracted components; the sheet gets `phone`.

### `useSubPortalFocusPulse` — 659–676
- `ref` + `lit` state; effect on `[focused]`: 120 ms → `scrollIntoView({block:'center'})` (instant under reduced motion) + light; 5,200 ms → unlight; both timers cleared.
- **Contract:** returns `{ref, className}`; the ids `subPortalFocusDomId({kind,id})` are the landing for `withSubPortalFocus` in `src/components/jobs/SheetStoryModal.tsx:343`. `SheetCard` puts id/ref on the **rail wrapper** (977), `OfferCard` on the **card root** (1253) — the smoke test asserts the wrapper's text contains the progress control.
- **Approach:** move to `src/components/subPortal/useSubPortalFocusPulse.ts` before either card moves.

### `SheetCard` — 684–1118 (435; 15 `useState`)
Props `sheet, lang, t, submitToken, preparedOn, payRunDayLabel, focused`. **All state is seeded from props once** (`useState(sheet.stage)` etc.) and then optimistic — the payload is never refetched.

| Sub-region | Owned state | Handlers / derived | Renders | Notes |
|---|---|---|---|---|
| Status words 792–817 | — (reads `stage`, `stageSource`, `stageChangedOn`) | `payWhenParts`, `queued`/`stageIndex` (kernels `isSubPortalSheetQueued`/`subPortalRailStep`), `railLabels`, `chip`, `changedLabel`, `sentence` | chip 873–887, rail 978–985, sentence 986–988, pay-when 989–994 | ES article `' el '` hard-coded at 817 |
| Dates 756–790, 891–941 | `dates`, `dateUi` (lazy init: opens `picking` when `changeRequested && window`), `dateError` | `moveDates(start)` → `pickEndFromStart`, POST `pick_dates` | change-request band, window sentence, Change button (only `stage === 'working'`, 914), `SubPortalDatePicker` | the confirm label recomputes `pickEndFromStart` inline (932) |
| Money rows 942–973 | — | — | items, Agreed · **Paid (`sheet.paid + sheet.backcharges`, 962)** · Open | mirrors the server's `buildSubTotals` convention (`_shared/subPortalStatement.ts:526`) |
| Rail + agreement 975–1017 | — | — | rail, `<details>` "What you agreed to" + `ReferencesBlock` + ticked acknowledgements | focus wrapper 977–1114 encloses rail → work-done; the sentence slot (987) reads work-done `ui` (`done` → thanks line) |
| Progress 709–718, 720–753, 1019–1076 | `progress`, `progressOn`, `pend`, `progNote`, `progUi`, `progError` | `shownPct`/`pctChanged`/`noteTyped`/`showSend` 715–718; `sendProgress` | 0/25/50/75/100 chips, bar, note (300-char cap), Send | **100 does not send** — the Send click copies `progNote` into `note` and opens the work-done confirm (1063–1066) |
| Work done 702–707, 819–850, 1077–1113 | `stage`, `stageChangedOn`, `stageSource`, `ui`, `note`, `error` | `markWorkDone` → POST `mark_work_done`; `finish` flips to walkthrough/portal | confirm textarea, Confirm / Not yet (Not yet also clears `pend`) | error fallbacks English-only (844, 847) |

- **Coupling:** progress ↔ work-done share `ui`, `note`, `pend` and both gate on `stage === 'working'` (cannot split apart); the rail sentence (987) also reads `ui`; dates reads `stage` only (splittable as `SubPortalSheetDates` with `stage` as a prop).
- **Tests:** static text only (items, payable-after, "How far along…", "100% ✓", walkthrough sentence). No handler is exercised.
- **Approach:** after Stage A (status words, progress draft, submit client) move whole to `src/components/subPortal/SubPortalSheetCard.tsx`; then split `SubPortalSheetDates.tsx`.

### `OfferCard` — 1130–1450 (321; 8 `useState`)
Props `offer, payload, lang, t, submitToken, focused`. `ui: OfferUiState` 1120–1128 (`idle / signing / declining / cantdo / submitting / accepted / declined / askedBack`).
- **Owned state:** `ui`, `printedName`, `agreedTerms` (both written only through `ContractAcceptSignatureForm`'s `onPrintedNameChange`/`onAgreedChange` props, inside the signing branch 1359–1413), `declineReason`, `cantDoNote` (300-char cap), `pickStart` (written via `SubPortalDatePicker onChange={setPickStart}`), `error`, `ticked: Set<number>` (ack indexes).
- **Gate 1154–1165:** `allTicked`, `pickEnd = pickEndFromStart(pickStart, offer.workDays)`, `needsPick = !!offer.window`, `pickOk`; `bookRefs` + `disclosure` (names book references with version dates).
- **`msaLine` memo 1167–1179:** finds a signed doc whose name matches `/master subcontract/i` and splices `, signed <date>.` onto the translated `underMsa` string via `base.slice(0, -1)` — string surgery on a translation.
- **Writes 1181–1250:** `post` adds `token` + `commitmentId` and the sample short-circuit. `submitAccept` re-checks `allTicked` then `pickOk` (sets `acksMissing` / `pickRequired`), sends `agreedTerms: true` **hard-coded** and `acknowledgements: offer.acknowledgements` (the whole list — the tick proof lives only in `allTicked`), drawn signature PNG when `mode === 'draw'`, ESIGN consent from `esignConsentText({audience:'sub', lang, documentNoun})` (ES noun hard-coded at 1396).
- **Render 1252–1449:** head/lines/refs/expiry 1253–1279; pick window 1281–1295; outcomes 1296–1306; can't-do form 1307–1327; idle actions 1329–1357; signing (acks + `ContractAcceptSignatureForm` + cancel) 1359–1413; decline 1415–1447.
- **Tests:** title + "Sign to accept" text only. `ContractAcceptSignatureForm` has its own render tests (`ContractAcceptSignatureForm.render.test.tsx`, `.lang.render.test.tsx`); `esignConsent.test.ts` covers the consent text. The card's gate, bodies and state machine: **none**.
- **Approach:** Stage A the gate (`offerAcceptReadiness`) + `msaLine`/`disclosure`; give `submitting` an action discriminator (see Hazards) in its own PR; then move to `src/components/subPortal/SubPortalOfferCard.tsx` with a render test that drives sign / decline / can't-do.

### `DocRow` — 1452–1562 (111; 2 `useState`)
- **Owned:** `opening`, `error`. **Derived:** `badge` 1468–1473 (on_file / expiring / else), `detailText` 1475–1488 (switch on `doc.detail.kind`).
- **Handler `openSigningPage` 1490–1515:** sample → `/contract/accept?t=<sample token>`; else POST `sign_link`, navigate only when `signPath.startsWith('/contract/accept?')` (open-redirect guard, **untested**).
- **Render:** badge, name, detail, "Sign now" (`data-screen-only`) + print-only "sign at <short address>".
- **Approach:** first Stage-B move → `src/components/subPortal/SubPortalDocRow.tsx` (props already clean: `doc, payload, lang, t, submitToken`; it reads only `payload.slug`, so narrow to `slug`).

---

## Shared substrate

- **No selection pointer.** The page is one read-only snapshot (`state.payload`) loaded once; there is no tab, no selected row, no refetch.
- **Threaded context:** `lang` + `t` + `submitToken` (+ `preparedOn`, `payRunDayLabel`, `focus`) go by prop to every card. A `SubPortalContext` (`{lang, t, submitToken, todayYmd}`) is optional sugar, not a prerequisite.
- **The real shared engine is the write channel:** six hand-rolled `fetch('…/submit-sub-portal')` sites (623–637, 736–752, 773–789, 833–849, 1184–1195, 1498–1514), each with its own copy of `if (sampleStateFromToken(submitToken))` and the `{ok, error}` parse. **Seam:** `postSubPortal(submitToken, body)` in `src/lib/subPortal/submitSubPortal.ts` returning `{ok, error?, data?}`, with typed body builders per kind — lands before any card moves so the moved cards import it instead of carrying copies.
- **Optimistic local mirrors:** each card owns its slice after mount (`SheetCard` stage/dates/progress, `OfferCard` outcome). They key by `sheet.id` / `offer.id`; if a refetch is ever added, the cards will not resync.
- **URL state** (`t`, `:slug`, `demo`, `preview`, `focus`) is parsed only in the shell and stays there.

## Stage-A inventory

**Already extracted (pure, tested unless noted):**

| Kernel | Exports used here | Test |
|---|---|---|
| `src/lib/subPortal/subPortalPayload.ts` | `parseSubPortalPayload` + types | `subPortalPayload.test.ts` (v2.2789 fields, v2.3605 traces) |
| `src/lib/subPortal/subPortalI18n.ts` | `subPortalT`, `formatSubPortalDate`, `formatPayRunDay` | `subPortalI18n.test.ts` |
| `src/lib/subPortal/subPortalRail.ts` | `isSubPortalSheetQueued`, `subPortalRailStep` | `subPortalRail.test.ts` |
| `src/lib/subPortal/subPortalFocus.ts` | `parseSubPortalFocus`, `isSubPortalFocused`, `subPortalFocusDomId` | `subPortalFocus.test.ts` |
| `src/lib/subPortal/subPortalGuideStrings.ts` | `subPortalGuide` | `subPortalGuideStrings.test.ts` |
| `supabase/functions/_shared/subPick.ts` | `pickEndFromStart` (the module is shared with `submit-sub-portal`, which imports `evaluatePick`/`canChangePick`, not this) | `src/lib/subPortal/subPick.test.ts` |
| `src/lib/portal/portalPayload.ts` | `formatPortalUsd` | `portalPayload.test.ts` |
| `supabase/functions/_shared/subPortalStatement.ts` (server) | builds every figure the page shows (`buildSubSheets`, `buildSubTotals`, …) | `src/lib/subPortal/subPortalStatement.test.ts` (358 lines) |
| `src/lib/subPortal/subPortalDemoFixture.ts` | `SUB_PORTAL_DEMO_PAYLOAD` | fixture (drives the render smoke) |
| `src/lib/customerSampleMode.ts`, `publicFunctionStaffHeaders.ts`, `publicViewCounting.ts` | headers / sample / preview flag | `publicViewCounting.test.ts` only |

**Still inline (move to `src/lib/subPortal/**` + tests):**

| # | Symbol (lines) | Proposed kernel | Why |
|---|---|---|---|
| A1 | `queuedNow` 341–346 + `laterAmount` 347 | `subPortalPaySplit(payload) → {queued, later}` in `subPortalMoney.ts` | **untested money** on the head figure |
| A2 | Paid column `sheet.paid + sheet.backcharges` 962; signed amount 491 + 516 | `subPortalSheetFigures(sheet)`, `formatSubPortalSignedUsd(n)` in `subPortalMoney.ts` | money parity with server `buildSubTotals`; dedupes two copies |
| A3 | `onToggleOff` 623–637, `sendProgress` 732–752, `moveDates` 769–789, `markWorkDone` 829–849, `post` 1181–1196, `openSigningPage` 1491–1514; `signPath` guard 1505 | `postSubPortal` + body builders + `isSafeSignPath` in `submitSubPortal.ts` | six copies of transport + sample short-circuit; redirect guard |
| A4 | `allTicked`/`pickEnd`/`pickOk` 1154–1158 + precheck order 1199–1208 | `offerAcceptReadiness({acks, ticked, window, workDays, pickStart})` in `subPortalOffer.ts` | e-sign gate, untested |
| A5 | `bookRefs`/`disclosure` 1159–1165, `msaLine` 1167–1179 | `offerDisclosureVars`, `msaSignedLine(docs, lang)` in `subPortalOffer.ts` (or new i18n keys) | regex + `slice(0,-1)` on a translation |
| A6 | `payWhenParts` 792–794, `chip` 801–807, `sentence` 809–817 | `subPortalSheetStatus(...) → {chipKey, sentenceKey, vars}` in `subPortalRail.ts` | stage wording logic; keeps `t` out of the kernel |
| A7 | `shownPct`/`pctChanged`/`noteTyped`/`showSend` 715–718, `pct` pick 721 | `subPortalProgressDraft(progress, pend, note)` | Send vs done-confirm routing |
| A8 | `badge` 1468–1473, `detailText` 1475–1488 | `subPortalDocBadge(doc)`, `subPortalDocDetail(doc) → {key, vars}` in `subPortalDocs.ts` | small, pure |
| A9 | query 162, error pick 169–174 | `subPortalLoadUrl`, `subPortalLoadError` | load contract (optional) |

## Test coverage

| Region | Covered by | Gap |
|---|---|---|
| Shell load / error / focus | `src/pages/SubPortal.render.test.tsx` (3 cases: full statement, `?focus=` halo + one `scrollIntoView`, dead-link error) | missing-key, network error, `/s/:slug`, lang toggle, sample banner, `?demo=1` |
| Head figure | smoke asserts `$4,180.00` ≥ 2× | **queued / later split (money)** |
| Ledger | memo text, minus-note, "Balance owed" | trace rows, signed formatting |
| Your days | `src/components/subPortal/SubPortalYourDays.render.test.tsx` (mocked `onToggleOff`) | the page's `day_off` POST |
| Sheet / Offer / Doc handlers | — | **all 8 write kinds, the offer gate, the `submitting` state machine, the `signPath` guard** |
| Server | `subPortalStatement.test.ts` (figures), `subPick.test.ts` (pick rules) | `submit-sub-portal` request contract (no test names any kind) |

## Recommended extraction order (value ÷ risk)

1. **A1 + A2 → `src/lib/subPortal/subPortalMoney.ts` + test** (~40 lib / ~60 test; −12 page) — untested money first.
2. **A3 → `src/lib/subPortal/submitSubPortal.ts` + test** (~90 lib; −60 page) — the write seam every later move imports.
3. **A4 + A5 → `src/lib/subPortal/subPortalOffer.ts` + test** (~50 lib; −25 page).
4. **A6 + A7 + A8 → `subPortalRail.ts` additions + `subPortalDocs.ts` + tests** (~70 lib; −45 page).
5. **Fix `OfferUiState.submitting` → `{kind:'submitting', action}`** as its own behavior PR with a render test (~15 lines).
6. **Stage B: `DocRow` → `src/components/subPortal/SubPortalDocRow.tsx`** (~105; props-only).
7. **Stage B: styles + `ReferencesBlock` + `PrintPageHeader` + `useSubPortalFocusPulse` → `subPortalStyles.ts`, `SubPortalReferencesBlock.tsx`, `useSubPortalFocusPulse.ts`** (~100 total) — shared prerequisites for the cards.
8. **Stage B: `OfferCard` → `SubPortalOfferCard.tsx`** (~290 after A3–A5) + a render test driving sign / decline / can't-do.
9. **Stage B: `SheetCard` → `SubPortalSheetCard.tsx`** (~390 after A2/A3/A6/A7), then split `SubPortalSheetDates.tsx` (~85).
10. **Stage B: Payments ledger → `SubPortalLedger.tsx`** (~125).
11. **Stays:** `SubPortal` shell (URL, load, `lang`, `<style>`, letterhead) + `SubPortalStatement` composition (head, explainer, section heads, Your-days wiring) — ~380 lines when done.

## Hazards

| Hazard | Where | Rule for the move |
|---|---|---|
| **Money: queued/later split untested** | 341–347, 366–376 | land A1 with tests before touching the head |
| **Money: client re-derives server conventions** | Paid = `paid + backcharges` (962) ↔ `_shared/subPortalStatement.ts:526`; `open > 0` filter (344) ↔ per-sheet floor `:527` | keep the head/recap on server `totals`; if the server convention changes, the kernel changes with it |
| **Capability-link auth** | read: token/slug → service-role fn; write: `submitToken` in the body | never add a direct supabase table read to this page (no RLS path exists for an anonymous sub) |
| **Writes carry no `apikey`/`Authorization`** | all six POSTs | they work only because `submit-sub-portal` has `verify_jwt = false`; `postSubPortal` should add `staffAwarePublicHeaders()` like `LegalPortal.tsx:62` does, in a separate verified PR |
| **Slug-opened writes depend on `requestToken`** | 189 ↔ `sub-portal/index.ts:403` (`link.token ?? null`) | a hash-only link (no raw `token`) leaves `submitToken = ''` on `/s/:slug` → every write refused |
| **Sample mode is client-only on writes** | `sampleStateFromToken(submitToken)` at 624, 732, 769, 829, 1183, 1491; `submit-sub-portal` has no sample branch | the short-circuit must survive the move into `postSubPortal`, or the "What customers see" walkthrough shows errors |
| **E-sign payload** | `agreedTerms: true` hard-coded (1214); `acknowledgements: offer.acknowledgements` (whole list, 1215); consent 1396 | preserve byte-for-byte; the server's check (`submit-sub-portal` ~510–513) compares against the snapshot, so `allTicked` is the only tick proof |
| **`submitting` has no action tag** | branches 1281, 1307, 1359, 1415 infer the in-flight action from field contents | today a can't-do send also shows the signing panel (1359 matches `submitting && !declineReason.trim()`), and a stale `declineReason` from a cancelled decline routes an accept's spinner to the decline panel — fix as step 5, not during a move |
| **Open-redirect guard** | `signPath.startsWith('/contract/accept?')` 1505 | keep; test it in A3 |
| **Focus deep link** | ids `sp-focus-<kind>-<id>`; `SheetCard` wrapper 977 vs `OfferCard` root 1253; effect `[focused]` with 120 ms / 5,200 ms timers | office `SheetStoryModal.tsx:343` produces the URL; the smoke test pins the wrapper placement |
| **Page-level CSS the cards rely on** | `<style>` 202–229 (`.sp-rail`, `.sp-st`, `.sp-focus`, print attrs) | a moved card rendered outside this page loses its rail/halo styling — keep the block in the shell or co-locate it with the rail |
| **Props seeded once** | `useState(sheet.stage)` 702–714, `useState(sheet.dates)` 756, `dateUi` lazy init 757 | fine while there is no refetch; adding one needs a key or resync |
| **Print/screen split** | `data-screen-only` (offers, controls), `data-print-only`, `data-print-page`, `data-avoid-break` | carry attributes verbatim; offers must never print |
| **i18n leaks** | EN/ES ternaries outside `subPortalT`: 374, 817, 1174–1176, 1396; English-only errors 157, 173, 180, 747, 750, 784, 787, 844, 847, 1223, 1234, 1247, 1509, 1511 | note, don't fix during a move; new strings go through `subPortalT` |
| **Theme** | single-theme `data-theme="light"` (193); raw status hexes (`#e8f3ea`, `#e7effa`, `#1d4e89`, `#f6e6d8`, `#0f766e`, `#9aa5a1`, `#e6e0d2`, `#fbf1e8`, `#fdf1e3`, `#fbe9e7`); three textareas use `var(--surface)` (1086, 1315, 1422) | keep the light wrapper; saturated status colors stay literal |
| **Realtime / role gates** | none — public page, no subscriptions, no role checks (staff presence only changes view counting server-side) | — |
