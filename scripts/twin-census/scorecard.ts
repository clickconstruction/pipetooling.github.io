// T4 auto-scorecard CLI (vite-node) — run at every backtest/shadow unseal.
//
//   npx vite-node scripts/twin-census/scorecard.ts -- ref-rows.json twin-items.json [set-tags.json]
//
// ref-rows.json:  [{"fixture": "SK-1", "count": 3, "page": "7"}, ...]
//                 (bids_count_rows of the reference bid, via the twin REST lane)
// twin-items.json: [{"name": "SK1", "count": 2}, ...]  (the twin's takeoff tally)
// set-tags.json:  ["SK1", "EWC1", ...]  (tags found in the fetched plan set —
//                 from the T1 census or text census; enables the scope-match check)
//
// Prints the JSON scorecard, then a short human summary. Exit code 2 when the
// scope-match check FAILS — a failing run must not be scored (PLACEMENT.md).
import { readFileSync } from 'node:fs'

import { compareTakeoffs, type RefRow, type TwinItem } from '../../src/lib/twinScorecard'

const args = process.argv.slice(2).filter((a) => a !== '--')
if (args.length < 2) {
  console.error('usage: scorecard.ts ref-rows.json twin-items.json [set-tags.json]')
  process.exit(1)
}

const refRows = JSON.parse(readFileSync(args[0], 'utf8')) as RefRow[]
const twinItems = JSON.parse(readFileSync(args[1], 'utf8')) as TwinItem[]
const setTags = args[2] ? (JSON.parse(readFileSync(args[2], 'utf8')) as string[]) : []

const card = compareTakeoffs(refRows, twinItems, setTags)
console.log(JSON.stringify(card, null, 2))

const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`)
console.error('')
console.error(`scope-match: ${card.scopeMatch.verdict}` +
  (card.scopeMatch.missingFromSet.length
    ? ` (missing from set: ${card.scopeMatch.missingFromSet.join(', ')})`
    : ''))
console.error(`fixture accuracy: ${pct(card.fixtureAccuracy)} across ${card.fixtures.length} tags`)
for (const f of card.footage) {
  console.error(`footage ${f.system}: twin ${f.twinFt.toFixed(0)} ft / ref ${f.refFt.toFixed(0)} ft` +
    (f.ratio !== null ? ` (${f.ratio.toFixed(2)}x)` : ''))
}
if (card.scopeMatch.verdict === 'fail') {
  console.error('SCOPE MISMATCH — do not score this run; flag the reference (PLACEMENT.md).')
  process.exit(2)
}
