import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2319',
  date: '2026-08-25',
  title: 'Data health list, decluttered',
  kind: 'feature',
  highlights: [
    'Every payment row now shows the billed → paid dates the medians measure, with the full address on its own line.',
    '"Unlinked" is gone — chips now say what\'s actually wrong: "no bill" or "no bill date". The filter pill reads "Missing info".',
    'A missing bill date can be typed right on the row (MM/DD/YY) — the row turns measurable on the spot. Works in the Undated bills list too.',
    'Less repeated text: the line-item headers are gone, and bill totals only get their own line when there\'s something to sum.',
  ],
}

export default note
