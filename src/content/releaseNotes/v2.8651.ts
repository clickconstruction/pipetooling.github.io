import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8651',
  date: '2026-11-26',
  title: 'First look: the page says The office has your answer once',
  kind: 'fix',
  highlights: [
    'After Send my answer, the page said The office has your answer twice: in a green line under the button and in a note that slid in.',
    'Now the green line under the button says it, and it stays. The second note is gone, so a screen reader says it once too.',
    'If the answer cannot be sent, the page still says why.',
  ],
}

export default note
