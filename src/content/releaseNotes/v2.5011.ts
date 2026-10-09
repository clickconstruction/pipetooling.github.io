import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5011',
  date: '2026-10-09',
  title: 'Dispatch Mode: controllers get the PO tab',
  kind: 'fix',
  roles: ['controller'],
  highlights: [
    'A controller in Dispatch Mode now has the PO tab, the three-tap code for the counter, as an assistant does.',
    'It is on by default. Turn it off from the gear menu under PO tab.',
  ],
}

export default note
