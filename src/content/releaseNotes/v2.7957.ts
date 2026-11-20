import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7957',
  date: '2026-11-19',
  title: 'Lien letters: one period after a name that ends in one',
  kind: 'fix',
  highlights: [
    'The cover letter on a lien notice printed two periods when the original contractor\'s name ended in one, as in "working under Acme & Assoc..". It prints one.',
    'The same holds for our own name, on every cover letter the Lien desk prints, and on a letter saved before today.',
    'No other word of counsel\'s letter changed.',
  ],
}

export default note
