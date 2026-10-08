import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4949',
  date: '2026-10-08',
  title: 'My Time day editor: the day’s sessions load from one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that loads a day’s clock sessions in the time editor moved to its own file. It covers who is signed in, whose day it is, its sessions and the clock for an open session.',
    'Nothing changes on screen. The day loads, reloads and counts exactly as it did.',
    'New tests cover that load for the first time, including a read that a newer one replaced.',
  ],
}

export default note
