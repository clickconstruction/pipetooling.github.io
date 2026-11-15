import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7365',
  date: '2026-11-15',
  title: 'Scores: the numbers are worked out on the server, so no wage comes to the browser',
  kind: 'feature',
  highlights: [
    'People → Review → Scores now asks the server for the two scores. The server prices the hours and sends back hours and dollars by job. Nobody’s wage leaves it.',
    'The numbers are the same ones: the server runs the same code the page ran, not a second copy of the arithmetic.',
    'The tab says where the scores were read, under The hurdle.',
  ],
}

export default note
