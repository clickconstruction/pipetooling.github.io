import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7018',
  date: '2026-11-12',
  title: 'Test runs on a developer machine no longer reach the live database',
  kind: 'fix',
  highlights: [
    'The automated tests a developer runs before a change goes out used to send a few hundred refused requests to the live database on every run. They now hold a stand-in address that answers nobody.',
    'The database error chart shows real trouble again, where test noise was about nine errors in ten. Nothing changes in the app itself.',
  ],
}

export default note
