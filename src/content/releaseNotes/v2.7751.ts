import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7751',
  date: '2026-11-18',
  title: 'Bill Customer: one shared piece draws every fold-out section',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the seven fold-out sections of the Bill Customer window (line item override, memo and footer on each bill, and the HouseCall Pro memo) are now drawn by one shared piece. Each was written out by hand before.',
    'Nothing changes on screen. The sections open, close and keep what you typed exactly as before, and no send or record press was touched.',
  ],
}

export default note
