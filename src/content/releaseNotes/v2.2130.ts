import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2130',
  date: '2026-08-22',
  title: 'Pipeline: every open bill now has an age',
  kind: 'fix',
  highlights: [
    'Who owes what, the 30+/90+ chips, the Waiting-on-customers age bar and the "Chase the 90+ tail" card all read one clock: the day the bill was billed — or the est. bill date when someone set one by hand (a correction always wins).',
    'Before, ages counted only from the hand-typed est. bill date, which normal billing never fills in — 60 of 65 open bills read "no date". Now they all age; "no bill line" appears only for a billed job with no bill line.',
    'Hand-dated ages carry a small dot after the days so you can tell a corrected date from an app-stamped one.',
  ],
}

export default note
