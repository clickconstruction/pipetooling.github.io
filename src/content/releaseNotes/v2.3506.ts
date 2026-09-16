import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3506',
  date: '2026-09-16',
  title: 'Supply houses: deleting a credit says so',
  kind: 'fix',
  highlights: [
    'The confirmation when you delete a credit memo now asks "Delete this credit?" instead of calling it an invoice.',
    'Closes out the return / credit memo work: the form, the aging column and the job cost were all checked live on a real credit and it behaved.',
  ],
}

export default note
