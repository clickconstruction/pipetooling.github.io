import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3866',
  date: '2026-09-26',
  title: 'Estimates: the line math has tests',
  kind: 'fix',
  highlights: [
    'What a typed count or price becomes on an estimate line, how a change to one line recomputes its amount, how a catalog entry becomes a line, and what the placeholder first line looks like — all of that lived inside the Estimates page with no test. It now lives in one small module with thirteen, including the change-order credit line and the rounding of typed dollars.',
    'Nothing on screen changes; every line computes as before.',
  ],
}

export default note
