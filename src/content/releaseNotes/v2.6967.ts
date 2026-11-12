import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6967',
  date: '2026-11-11',
  title: 'An agent on the dev seat can fill in a bid’s Count Sheet',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now add, change and remove count rows on a bid, the way the Count Sheet does: a fixture, its count, its unit, its plan page and the area it sits under.',
    'It keeps the sheet’s own rule of one row per fixture in the base bid or in an alternate. An area is a label on the row, and a group marked as an alternate is priced with and without.',
    'Before anything changes the agent reads a plan in words: each row as it will read, the sheet’s totals before and after, and what a removed row takes with it.',
    'A row with a fault is held with its reason and the rest still goes on, so one bad line never stops a whole sheet.',
  ],
}

export default note
