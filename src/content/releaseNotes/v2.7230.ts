import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7230',
  date: '2026-11-13',
  title: 'The Bridge no longer says a wait such as 7 to 7 weeks when Build is the slowest step',
  kind: 'fix',
  highlights: [
    'When Build is the slowest step, the Bridge says how many weeks it takes to build what is already sold. Jobs with no percent make that a range.',
    'When both ends of the range rounded to one number, the sentence said the number twice, as in 7 to 7 weeks. It now says one figure, such as 7.2 weeks.',
    'A real range, such as 7 to 8 weeks, reads as before. The Monday email says the same sentence as the page.',
  ],
}

export default note
