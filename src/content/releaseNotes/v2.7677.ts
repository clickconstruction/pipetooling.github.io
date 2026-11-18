import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7677',
  date: '2026-11-17',
  title: 'Supply houses: the page’s data is read in one file of its own',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Accounts payable and a house’s bills load as they did, on Materials and in Quickfill.',
    'The reads behind the page, the house list, the book and the open house, moved into one file with its own tests.',
  ],
}

export default note
