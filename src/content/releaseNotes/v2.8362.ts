import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8362',
  date: '2026-11-23',
  title: 'Dispatch inbox: a row’s doors are thumb-sized on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the doors on a Dispatch inbox row, like Open the list and Open the job, were small presses. Each is now 44 px tall.',
    'Two doors sit side by side when they fit across the row and stack one above the other when they do not.',
    'In the window a row opens, Lower priority and Open the job › are 44 px tall on a phone too.',
    'On a desktop the doors keep their size in their column at the right of the row.',
  ],
}

export default note
