import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4994',
  date: '2026-10-08',
  title: 'Dispatch: the job picker’s list moved to its own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the list in the Dispatch job picker moved out of the page into its own file. That covers its search, the job number box, the rows and the paid and billed details beside them.',
    'Nothing changes on screen. The search and the number box still start empty each time the picker opens.',
    'New tests cover how the list narrows, when the details load, and the same-address warning.',
  ],
}

export default note
