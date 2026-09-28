import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3967',
  date: '2026-09-27',
  title: 'My Time day editor: job labels and the empty-day check are their own pieces',
  kind: 'fix',
  highlights: [
    'Two jobs the day editor does in the background were written inside it with no tests: looking up the name of a job or bid it was not given, and asking a salaried person’s schedule why their day is empty. Each is its own piece now, with 43 tests between them.',
    'Nothing on screen changes.',
  ],
}

export default note
