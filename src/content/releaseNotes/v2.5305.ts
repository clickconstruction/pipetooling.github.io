import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5305',
  date: '2026-10-12',
  title: 'Messages: a flow step can wait on a paper made in the Contract library',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'A paper added from the Contract library can now finish a step, once it is on file, current, signed or sent.',
  ],
}

export default note
