import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2530',
  date: '2026-08-31',
  kind: 'feature',
  title: 'Robot readiness icon on every Bid Board row',
  highlights: [
    'A robot icon now sits beside each bid number: yellow when a robot has everything it needs to bid it, grey when something is missing, and 🤖 when a robot bid already exists.',
    'Click grey to see exactly what is missing and how to fix it; click yellow to copy a ready-made kickoff prompt for the robot.',
    'Click 🤖 to jump straight to the robot’s bid on the Robot Board. A side-by-side comparison view is coming next.',
  ],
}

export default note
