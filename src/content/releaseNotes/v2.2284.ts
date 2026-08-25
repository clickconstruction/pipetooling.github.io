import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2284',
  date: '2026-08-25',
  title: 'Locked stages explain their unlock chain',
  kind: 'feature',
  highlights: [
    'Tap the 🔒 chip on a locked goal stage to see the full unlock chain — every unfinished stage that has to finish first, not just the next one, each with its progress.',
    'The direct blocker wears an "unlocks it" tag; tapping any stage in the list jumps the Review board to it and flashes it blue so your eye lands in the right place.',
    'Locked stages with no tasks open the chain with a tap anywhere on the row.',
  ],
}

export default note
