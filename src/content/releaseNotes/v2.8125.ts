import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8125',
  date: '2026-11-21',
  title: 'Lien desk: a missed notice with nothing due shows no empty tick column',
  kind: 'fix',
  highlights: [
    'On a missed notice with no month still due, Months on this job showed a This notice column of empty boxes. None of them could be ticked.',
    'That column is gone there now. It still shows wherever a month can be ticked, or a notice already names its months.',
  ],
}

export default note
