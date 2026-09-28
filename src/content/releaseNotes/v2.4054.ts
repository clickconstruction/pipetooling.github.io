import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4054',
  date: '2026-09-28',
  title: 'Pipeline money cards: the numbers on a chip are never cut off',
  kind: 'fix',
  highlights: [
    'On the "jobs burning" card, a long job name no longer pushes "56% spent at 30% done" off the end of its chip — the name is what gets shortened, the numbers stay.',
    'The lien-notices card leads its deadline chip with the count and the day ("15 notices by Oct 15 · in 17 days"), and the GCs on that day are a chip of their own.',
  ],
}

export default note
