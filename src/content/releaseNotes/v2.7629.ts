import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7629',
  date: '2026-11-17',
  title: 'Estimates: the list is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Estimates list, with its Pipeline and Ledger tabs, moved out of the big estimate page into its own file.',
    'Nothing changes on screen. The lanes, the search, the Ledger’s totals, New estimate and New change order work as before.',
  ],
}

export default note
