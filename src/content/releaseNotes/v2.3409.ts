import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3409',
  date: '2026-09-14',
  title: 'Takeoffs: Materials to order, the shopping list the sticks make',
  kind: 'feature',
  highlights: [
    'The Sheet view’s rail now carries “Materials to order”: one row per part sold in packs — 3/4" copper · 105 → 120 ft · 6 × 20 ft · +$41 — most expensive rounding first, with the total under it. One at a time folds the same list under the strip.',
    'Request quotes sends the quantities you will actually buy, not the per-fixture ones: “3/4" Type L Copper × 120 ft (105 ft needed · 20 ft sticks)”.',
    'A bid costed before a part had a rule can catch up: “Refresh Sold in rules from the catalog” under the list re-reads every line’s rule and says how many lines changed. The part’s Prices window from the sheet now shows and edits Sold in too.',
  ],
}

export default note
