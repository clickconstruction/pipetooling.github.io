import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3269',
  date: '2026-09-11',
  title: 'People → Overhead: click any bar of the pool chart to see what is in it',
  kind: 'feature',
  highlights: [
    'Every bar on the 90-day pool chart is now a door. Hover for the day’s split and its biggest line; click a colored segment for that category’s lines — the sessions behind office or bid labor, the purchases behind office parts — or the space above a bar for the whole day.',
    'The day panel tells you whether it’s normal: each purchase says how often that counterparty shows up in the window and whether this is its largest; each session says the person’s typical day and whether this is the longest; the header reads “3.4× a typical day”. Internal transfers are listed struck through as not counted; sessions still awaiting approval are marked. ‹ › walk the days, tabs flip categories, and links lead to Banking → Accounting or People → Hours to fix what you find.',
    'Under the chart, “Biggest single lines in these 90 days” lists the five largest lines with their share of the pool — hover one to see its bar, click to open it. Legend swatches hide a series so the others can be read on their own scale.',
  ],
}

export default note
