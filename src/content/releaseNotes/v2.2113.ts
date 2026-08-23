import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2113',
  date: '2026-08-22',
  title: 'Count Sheet: counts and line feet, told apart',
  kind: 'feature',
  highlights: [
    'The Count Sheet strip no longer adds 12 water closets to 148 feet of copper and calls it "160 units" — it now shows Counts (each) and Line feet (ft) as separate totals, each with how many rows it covers.',
    'Rows measured in feet (the takeoff\'s "ft of …" lines) get a small ft tag on the sheet; plan-page groups total "12 ea · 148.5 ft" instead of one mixed number.',
    'Lines copied from CountTooling without a scale ("px of …") show a red Unscaled tile and tag instead of quietly inflating the feet.',
    'Importing from /Tooling now reports what came in: "29 counts (1,122 ea) · 6 line types (444.74 ft)".',
  ],
}

export default note
