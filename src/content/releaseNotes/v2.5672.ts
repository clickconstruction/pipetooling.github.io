import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5672',
  date: '2026-10-20',
  title: 'Pricing: Undo sweep only undoes on the price card you swept',
  kind: 'fix',
  highlights: [
    'After a margin brush sweep, Undo sweep stayed on screen when you opened another price card. Pressing it there wrote the first card’s old prices into the card you had open.',
    'Undo sweep now belongs to the card you swept. It hides on any other card and comes back when you return.',
  ],
}

export default note
