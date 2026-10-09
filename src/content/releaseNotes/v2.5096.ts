import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5096',
  date: '2026-10-09',
  title: 'GC mode: seven Owner Billing presses go through the checked database calls',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, seven of Owner Billing’s calls now go through the app’s checked database types. They are Bill the interest, Accept the work, Remind them to pay, the Monday email’s list and its changes, and the answers to a trade’s ask for a change.',
    'Nothing changes on screen. Each press sends what it sent before and says the same words when it fails.',
  ],
}

export default note
