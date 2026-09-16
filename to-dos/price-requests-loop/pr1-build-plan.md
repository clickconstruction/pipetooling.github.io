# PR 1 build plan — stack the houses, save once

Status: **BUILT 2026-09-16 as v2.3495** · branch `claude/distracted-heyrovsky-1c595d` · live-tested on BP398 · client-only, no migration
Mock-up: *Ask Three Houses* — https://claude.ai/artifact/6UnHAG5VYBDmTtZomuhkof

The ask, 2026-09-15: "add multiple price requests, where once I add a supply house, a button is available to add an additional supply house."

This is PR 1 of the four-PR train in [`README.md`](./README.md), written out to the file and symbol level. PRs 2–4 are unchanged and not in scope here.

---

## What PR 1 does

`+ Add a request` opens a **block**, not a table row. Picking a house appends a card and collapses the picker; **+ Add another supply house** reopens it. Each card carries **its own day and its own quote link**. **Add 3 requests** writes all three rows in one insert.

Out of scope, on purpose: sending anything, the usual-houses pre-pick (PR 2), the status column and drop zone (PR 3), the robot door (PR 4).

## Decisions baked in

1. **Every house carries its own quote link.** The owner's call, 2026-09-16. It writes `request_url`, the same column the edit row's box writes, so the two paths can never disagree. Blank is normal on the day a request goes out; the row keeps **Edit** for pasting it later.
2. **Edit stays exactly as it is.** One row, one house, the link box, `validateOutsideRequest`. Only the *add* path becomes a batch.
3. **Every house carries its own day.** The owner's call, 2026-09-16. `planOutsideRequests` validates each entry's date separately and names the house at fault. There is no shared date field.
4. **No migration.** `bid_rfqs` already carries `sent_via`, `requested_on`, `request_url`, `quote_url` (migration `20260909001806`, applied). RLS is one blanket `FOR ALL` policy for dev / master_technician / assistant / controller / estimator, so a multi-row insert behaves exactly like today's single-row one.

## Two things the code does today that you should know before we change it

Both are pre-existing. Neither is fixed in PR 1 unless you say so.

- **The visible "Quote link" box writes `request_url`, not `quote_url`.** v2.3477 relabelled the box but kept the column. The consequence: a link pasted there does **not** mark the row `quoted` and does **not** count in the header's "N quotes in", because `quoteCellFor` reads `quote_url`. It *does* reach the pricing robot, because `buildPriceMatrixSources` prefers `quote_url` and falls back to `request_url`.
- **A hand-added row always saves as `status: 'sent'`.** The insert reads `status: v.quoteUrl ? 'quoted' : 'sent'`, and `draft.quoteUrl` has no input anywhere in the add or edit UI. The ternary can never take its first branch from this surface.

---

## 1. Kernel — `src/lib/bids/bidPriceRequests.ts`

Add, below `validateOutsideRequest`. Nothing existing is edited or removed; the edit path keeps using `OutsideRequestDraft` and `validateOutsideRequest` untouched.

```ts
/** One house in a batch of hand-sent requests being recorded together. */
export type OutsideRequestBatchEntry = { supplyHouseId: string; requestUrl: string }

export type OutsideRequestBatchDraft = { entries: readonly OutsideRequestBatchEntry[]; requestedOn: string }

/** A row ready to insert — the component adds bid_id, sent_via, status, scope. */
export type PlannedOutsideRequest = { supplyHouseId: string; requestedOn: string; requestUrl: string | null }

export function planOutsideRequests(
  d: OutsideRequestBatchDraft,
): { ok: true; rows: PlannedOutsideRequest[] } | { ok: false; error: string; atHouseId?: string }
```

Rules, in order:

| Condition | Result |
|---|---|
| `entries.length === 0` | `{ ok: false, error: 'Pick a supply house.' }` — the same string the single-row path uses |
| `requestedOn` fails `/^\d{4}-\d{2}-\d{2}$/` | `{ ok: false, error: 'When was it requested?' }` — same string as today |
| a `supplyHouseId` appears twice | `{ ok: false, error: 'That house is already in this batch.', atHouseId }` |
| an entry's `requestUrl` fails `normalizePastedLink` | `{ ok: false, error: \`Quote link: ${e}\`, atHouseId }` — same prefix as today |
| otherwise | `{ ok: true, rows }`, entry order preserved |

`atHouseId` exists so the component can name the house in the message and scroll its chip into view. The kernel never learns house names.

```ts
export type AskedHouse = { count: number; lastYmd: string }

/** Houses already asked on this bid, from the shaped groups the table already builds. */
export function askedHouseSummary(groups: readonly PriceRequestGroup[]): Map<string, AskedHouse>
```

Keyed by `houseId`, skipping `null` ones. `count` is `requests.length`; `lastYmd` is the newest `requestedYmd` (groups are already sorted newest-first inside a house, so it is `requests[0]`).

## 2. Kernel tests — `src/lib/bids/bidPriceRequests.test.ts`

Two new `describe` blocks appended, matching the file's existing style (186 lines, plain fixtures, no mocks).

- `planOutsideRequests`: no entries; malformed date; a duplicate house returns its id; a bad link returns the offending house's id; three good entries return three rows in order with `requestUrl: null` for blanks and a normalized URL for a pasted one.
- `askedHouseSummary`: counts per house, newest date wins, house-less groups are skipped.

## 3. Component — `src/components/bids/BidPriceRequestsTable.tsx`

### 3a. The structural change

`editorRow` is today a single JSX constant used in **two** places: inside `groupRows` when `editingId === r.row.id`, and at the bottom of `<tbody>` when `adding`. Split it:

- **`editorRow`** — today's four-cell row, verbatim. Only the edit path renders it.
- **`addEditorBlock`** — new. A single `<tr>` with one `<td colSpan={4}>` holding a flex block. Escaping the column grid is deliberate: the add form is no longer row-shaped, and `colSpan` gives the phone layout for free without touching the `narrow` minWidth logic.

### 3b. State

```ts
const [entries, setEntries] = useState<OutsideRequestBatchEntry[]>([])
const [pickerOpen, setPickerOpen] = useState(false)
```

`draft` / `setDraft` stay, now used only by the edit path. `adding`, `editingId`, `busy`, `error`, `houseQuery`, `showAllHouses` all stay.

- `startAdd()` — `setEntries([])`, `setPickerOpen(true)`, clear `houseQuery` and `error`, `setAdding(true)`.
- `startEdit(r)` unchanged.
- `cancel()` — also `setEntries([])`, `setPickerOpen(false)` and clear `houseQuery`.
- `pickHouse(id)` — append `{ supplyHouseId: id, requestedOn: todayYmdInAppTz(), requestUrl: '' }`, clear `houseQuery`, `setPickerOpen(false)`. This is the behavior the ask describes: the picker closes and the button appears.
- `updateEntry(id, patch)` — the per-card date and link both write through it.
- `removeEntry(id)` — filter it out; if the list empties, reopen the picker so the block is never a dead end.
- `+ Add another supply house` simply calls `setPickerOpen(true)`; the search input's own `autoFocus` fires on remount, so no ref is needed.

### 3c. The picker

`pickerHouses` gains two marks, computed from data already in scope:

```ts
const asked = useMemo(() => askedHouseSummary(groups), [groups])
const inBatch = useMemo(() => new Set(entries.map((e) => e.supplyHouseId)), [entries])
```

Per option row:
- **in this batch** — rendered disabled at `opacity: .55` reading `already in this batch`. Not clickable; removing the chip brings it back.
- **already asked on this bid** — still clickable, with a muted `asked ${formatWorkDateYmdMonthDayShort(lastYmd)} · already on this bid`. Asking a house twice on a revised scope is real, so it takes a deliberate tap rather than being blocked.

`addNewHouse(name)` is unchanged; `housePickerBody(onPick, marks)` now owns the search and list for both paths, so a freshly created house is handed to whichever `onPick` is in play.

### 3d. The block's markup

- A `<ul>` of cards, each `<li>` (`entryCard`): a header line of house name, the default rep from `defaultRepByHouse` (or `no rep on file` in `var(--text-amber-700)`, matching the picker) and a remove `<button aria-label={\`Remove ${name}\`}>×</button>`; under it the card's own two fields.
- `+ Add another supply house` under the list when the picker is closed; the search input and dropdown in its place when open. On the very first add the picker is already open, so the block reads exactly like today's first step.
- Per card: a date input, `aria-label={\`When the ${name} request went out\`}`, hint `when it went out`; beside it a url input, `aria-label={\`Quote link for ${name}\`}`, hint `the quote link, once it is back — you can add it later`. The pair wraps to one column at phone width.
- `error` above the buttons, full width, `var(--text-red-700)`.
- Buttons right-aligned: `Cancel`, then blue `Add request` at one entry and `Add N requests` above one. Disabled with `busy` and at zero entries, dimmed to `opacity: .55` when it is.

Styles come from the constants already in the file (`mini`, `ghost`, `blue`, `textBtn`, `meta`, `td`). No raw neutral hexes — `scripts/theme-tokenize.mjs --check src` runs in CI.

### 3e. Saving

Split `save()`:

- `saveEdit()` — today's body for the `editingId` branch, verbatim, with an `if (!editingId) return` guard at the top (the old code got its narrowing from the `if (editingId)` branch it lived in).
- `saveBatch()`:

```ts
const p = planOutsideRequests({ entries })
if (!p.ok) { setError(batchErrorText(p)); return }
const payload = p.rows.map((r) => ({
  bid_id: bidId,
  supply_house_id: r.supplyHouseId,
  sent_via: 'outside',
  status: 'sent',
  scope: {},
  requested_on: r.requestedOn,
  request_url: r.requestUrl,
  quote_url: null,
  created_by: user?.id ?? null,
}))
const { error: e } = await supabase.from('bid_rfqs').insert(payload as never)
```

`status: 'sent'` is written literally rather than through the old ternary, because the ternary's `quoted` branch is unreachable from this surface and a literal says so. One insert, one round trip. On success: `showToast(\`Added ${n} ${n === 1 ? 'request' : 'requests'}.\`, 'success')`, `cancel()`, `await load()`. On failure the block stays open with everything typed, so nothing is lost.

`batchErrorText(p)` turns `atHouseId` into `${houseName} — ${error}` using the `houses` array already in state.

### 3f. The footer

Unchanged, including the `outsideSupported === false` guard. The button keeps the label `+ Add a request`; the hint's `for a request you sent by email or phone` becomes `for requests you sent by email or phone`.

## 4. Render smoke — `src/components/bids/BidPriceRequestsTable.render.test.tsx` (new)

The file has no component coverage today. Follow the harness in `src/test/renderSmokeMocks.tsx`: the `// @vitest-environment jsdom` docblock, `vi.mock('../../lib/supabase', …)` with `makeSupabaseStub()`, and `renderWithProviders`. Three assertions:

1. It mounts with no rows and shows `+ Add a request`.
2. Clicking `+ Add a request` shows the house search input.
3. The block's Cancel closes it and leaves the footer button.

Wiring-level only. The batch arithmetic is the kernel's job and is tested there.

## 5. Copy to update

- `src/content/help/get-supply-house-prices-on-a-bid.md`, the **Requests you sent yourself** section. The current paragraph describes one house and the link box. Rewrite it for the chip list and `+ Add another supply house`, and say the link is pasted later through Edit. Keep the `{{button:blue|+ Add a request}}` token. `src/lib/helpGuideContent.test.ts` validates the frontmatter and title form, so leave both alone.
- The component's leading docblock, which currently says "Add a request records a request sent by email or phone".

## 6. Ship-with-the-PR files

`npm run claim` first, then name both files with the number it returns:

- `docs/recent-features/v2.NNNN.md` — first line `# v2.NNNN — <title> (2026-09-..)`. Record the two pre-existing oddities in section 0 above, so the next reader does not rediscover them.
- `src/content/releaseNotes/v2.NNNN.ts` — one `ReleaseNote`, user-readable, no file paths.

Never touch `src/content/releaseNotes.ts` or `docs/RECENT_FEATURES.md`. The drift test in `src/lib/releaseNotes.test.ts` fails CI until both files exist with the same version.

## 7. Gates and the live pass

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Then the live walk, before any commit:

- Dev login as Robert, Bids → Bid Board, search `ZZ Test` for BP398. **Hide map first** — the row sits below the map card. Gear on the row → Edit Bid → scroll to **Price requests**.
- Open the block, add Ferguson, confirm the picker collapses and the button appears. Add two more. Remove the middle one. Confirm the count on the Save button tracks.
- Reopen the picker and confirm a chipped house reads `already in this batch` and a previously asked house reads `asked <date>`.
- **Cancel** and confirm the table is untouched. Only then run it again and press Add, on BP398 only — it is prod.
- After the write: three grouped rows, the header summary reading `N houses · N requests · no quotes in`, and Edit on one row still opening today's single-row editor with its link box.

## Risks worth naming

- **The two editors must not share state.** The bug to watch for is opening Edit on a row while `batch.entries` still holds chips. `startEdit` and `startAdd` each clear the other's state, and the block and the row are never rendered at the same time because `adding` and `editingId` are mutually exclusive in the render.
- **`colSpan={4}` must track the header.** The table has four columns today. If PR 3 adds the status column, this number changes with it.
- **`load()` after insert is a full refetch** of rows, quotes, houses, reps and trade links. That is what the single-row save already does, so a batch is not a new cost, but it is why the toast fires before the table repaints.
- **Parallel sessions.** Several sessions ship on the Bids surface. Re-fetch `origin/main` and diff `BidPriceRequestsTable.tsx` before starting, and drop a session card in `.claude/sessions/active/`.

## The two open questions, answered 2026-09-16

The owner: "One date per supply house, And there should be an additional quote link for every house."

**A. The per-house link — in.** Every card carries its own quote link box, writing `request_url` exactly as the edit row's box does, so the two paths cannot disagree. The consequence from section 0 stands and is deliberate: a link typed there reaches the pricing robot but is not counted by the header's "N quotes in", because that count reads `quote_url`. Worth its own decision later.

**B. One date per house — in.** `OutsideRequestBatchEntry` carries `requestedOn`, and `planOutsideRequests` validates each entry's day separately, naming the house at fault. There is no shared date field.

Both were built as answered; the sections above describe the shipped shape.
