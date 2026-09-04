import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2778',
  date: '2026-09-04',
  kind: 'feature',
  title: 'Takeoffs New 1: cost a bid one fixture at a time',
  highlights: [
    'Pick New 1 beside the bid name: a rail of fixtures with done / to-do / $0 dots, and one fixture at a time on the right with what it usually gets — the book\'s entry and the last bids that costed the same fixture, each with a one-click "Use these lines" (re-priced at today\'s lowest catalog price).',
    'Tick "Remember these lines" and Done saves the fixture as an assembly and teaches the takeoff book its name, so the next bid starts filled in. Enter moves to the next uncosted fixture; ↑ ↓ move along the rail.',
    'The coverage strip shows costed N of M, the materials total Pricing uses, and any $0 lines. Old is unchanged and still the default; By Stage bids stay in Old.',
  ],
}

export default note
