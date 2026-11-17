import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7633',
  date: '2026-11-17',
  title: 'Estimates: the customer box and the line items are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the last large parts of a draft estimate moved out of the big estimate page into their own files: the customer box, the line items, and a change order’s own fields.',
    'The top of a sent estimate moved too.',
    'Nothing changes on screen. The estimate page is now a third of the size it was this morning, which makes each part easier to change safely.',
  ],
}

export default note
