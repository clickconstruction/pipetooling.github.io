import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8736',
  date: '2026-11-27',
  title: 'Messages on a small phone: the send button shows above the keyboard',
  kind: 'fix',
  highlights: [
    'On a small phone, a tap in a thread’s reply box brought up the keyboard and left Send text… or Send email… under it. You had to scroll to find it.',
    'The thread now scrolls by itself, so the box and its send button sit above the keyboard.',
    'It does this when you tap into the box and when the keyboard comes up. It does not move while you type or while you scroll back to read.',
  ],
}

export default note
