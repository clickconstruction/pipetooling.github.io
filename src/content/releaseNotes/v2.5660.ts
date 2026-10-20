import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5660',
  date: '2026-10-20',
  title: 'Pricing: see what a bid’s price is made of — material, sales tax, equipment and labor',
  kind: 'feature',
  highlights: [
    'Press the arrow before a fixture on the Workbench and its price opens into Material, Sales tax and Labor, each with its cost, price, profit and margin. Labor is what is left, so a row always adds up. Expand all and Collapse all sit under the Fixture header.',
    'Type a row’s own material price or markup, or make it tax-free. +% Markup › and Tax › beside Margin › set many rows at once by tag or kind, with one Undo; the Tax tool’s rate is the bid’s rate.',
    'Three cards under the table add it up: Traditional breakdown, Kind breakdown and Tag breakdown. Each folds to one line. Tag rows with your own words using the + under a row’s name; tags never print.',
    'A row’s kind chip (fixture, pipe, fitting, equipment, allowance) is the app’s guess until you pick one. An equipment row is one item and is never split.',
  ],
}

export default note
