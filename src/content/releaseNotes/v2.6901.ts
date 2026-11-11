import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6901',
  date: '2026-11-10',
  title: 'A part keeps each supply house’s own number for it',
  kind: 'feature',
  highlights: [
    'Under a part’s prices there is a new block, Their numbers. Type the number a supply house prints for the part and press Keep.',
    'One number means one part at a house. If the house already uses the number for another part, it says which.',
    'Parts Book has a new House numbers press. It finds the numbers already typed into part names and notes, and keeps the ones you approve.',
    'These numbers are how the price sheet reader will find a part with no press. That reader comes next.',
  ],
}

export default note
