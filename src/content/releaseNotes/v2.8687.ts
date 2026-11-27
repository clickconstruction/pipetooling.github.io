import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8687',
  date: '2026-11-26',
  title: 'Dev seat: a box is due a count only when it holds a line to count',
  kind: 'fix',
  highlights: [
    'Asked through the dev seat, a job’s boxes due a count are now the boxes the app calls due. The seat listed empty boxes too.',
    'A box is due when it holds something to count and nobody has counted it by hand in 14 days. An empty box is never due.',
    'The phone’s Count chip, the Materials desk and the Job Mode card have read it this way since v2.8612. Nothing changes on those screens.',
  ],
}

export default note
