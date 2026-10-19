import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5644',
  date: '2026-10-19',
  title: 'The app’s own description of the database knows an estimate’s shared links',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The links the office makes when it puts an estimate in a message are in the app’s generated description of the database and the dev seat’s catalog.',
    'The change was applied on the live database first, and the three functions that open an estimate from a link were redeployed before it.',
  ],
}

export default note
