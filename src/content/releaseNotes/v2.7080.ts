import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7080',
  date: '2026-11-12',
  title: 'Demand letter: a short letter no longer puts its signature alone on a second page',
  kind: 'fix',
  highlights: [
    'A demand letter that ran a few lines past one page now fits one page. The lines sit closer first. Then the type steps down, never under 10 point.',
    'A longer letter is unchanged. A letter with a statement of account and a pay code still takes two pages.',
    'The sample demand letter in Settings now says how to pay in a whole sentence.',
  ],
}

export default note
