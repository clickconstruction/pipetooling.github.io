import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7613',
  date: '2026-11-17',
  title: 'Estimates: a sent estimate’s screen is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, what you see on a sent, accepted or declined estimate moved out of the big estimate page into its own files.',
    'Resend link, Extend, Mark declined and Unlink job work as before.',
    'Two short lines now sit centered like the app’s other empty lists: the one that says nobody was set to be told, and the one that says no activity is on record yet.',
  ],
}

export default note
