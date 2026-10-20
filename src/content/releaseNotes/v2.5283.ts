import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5283',
  date: '2026-10-12',
  title: 'The portals’ server code passes its own type check again',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The code behind the trade partner’s and the customer’s portals is checked cleanly by the server’s own type checker.',
    'Nothing the portals show or do changes.',
  ],
}

export default note
