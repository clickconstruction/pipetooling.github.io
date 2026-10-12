import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5253',
  date: '2026-10-12',
  title: 'Messages: the boards read where every company stands, by step, by trade and by company',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The first piece of the Trade partners and Customers boards is in the app’s core, with nothing on screen yet.',
    'It reads one chip per company on each step, one per job when the step repeats, late first.',
    'The tiles count companies, not chips. A day still ahead is on time, and over usual is only a watch.',
    'By trade puts each company under every trade on its record. By company draws the first steps as a track.',
  ],
}

export default note
