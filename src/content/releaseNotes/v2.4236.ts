import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4236',
  date: '2026-09-30',
  title: 'Submittals: the printed procurement log puts the tag and the item in one column',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The procurement log you print or send as an update had a Tag column and an Item column, and on a landscape page the item was squeezed into a sliver five lines tall.',
    'Now one Item column leads with the tag in bold and the product beside it, the supply house after, so a row reads on one or two lines.',
    'The rest of the sheet is unchanged: the asks, the stages, the GC’s words in every cell, the notes, the signature line.',
  ],
}

export default note
