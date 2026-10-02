import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4380',
  date: '2026-10-02',
  title: 'Person desk: the last row stays above the bottom bar',
  kind: 'fix',
  highlights: [
    'With Dispatch mode or Job mode on, the bottom bar covered the last row of a person’s desk. That row holds Merge a duplicate… and Archive…, and the desk could not scroll it into view.',
    'The desk now ends where the bar starts, on a phone, an iPad and a computer, so every row can be reached.',
  ],
}

export default note
