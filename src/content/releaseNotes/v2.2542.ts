import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2542',
  date: '2026-08-31',
  kind: 'feature',
  title: 'Yellow robot click now requests a robot bid',
  highlights: [
    'Clicking a yellow robot on the Bid Board now requests a robot bid — the icon turns green, and clicking again withdraws. No more prompt to copy.',
    'A dev-only Queue view inside the 🤖 tab lists every robot-able bid, with requested ones first — that’s where the robot kickoff prompts live now.',
  ],
}

export default note
