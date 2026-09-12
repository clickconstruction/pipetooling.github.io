import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3370',
  date: '2026-09-12',
  title: 'Review counts salaried hours as clocked, like everyone else',
  kind: 'feature',
  highlights: [
    'People → Review used to give a salaried person a flat 8 hours every weekday, whether they clocked or not. It now reads their clock sessions, the same as hourly people — and the same as the Bridge.',
    'The ranked bars drop the "assumed" tag, the math drawer says "clocked hours", and the hygiene strip now points at salaried days with no clock time instead of the old assumption.',
    'With this, the last known gap between Review\'s Team Summary and the Bridge\'s Vectors closes.',
  ],
}

export default note
