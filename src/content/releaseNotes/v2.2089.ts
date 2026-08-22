import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2089',
  date: '2026-08-22',
  title: 'Roadmap Timeline: a real calendar instead of the pace slider',
  kind: 'feature',
  highlights: [
    'The Timeline now opens with a calendar band — months across the top, an amber "today" tick, a blue runway for the remaining work, and a 🎯 flag on the projected finish.',
    'No more "tasks/week" slider to interpret: the finish date comes from your real pace — tasks you actually completed in the last 4 weeks.',
    'If the finish lands more than a year out, the runway runs off the edge and the caption says what pace would bring it home within the year.',
  ],
}

export default note
