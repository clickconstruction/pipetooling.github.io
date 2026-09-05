import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2868',
  date: '2026-09-05',
  title: 'Robots: answers cannot spoil a blind run, and the price book opens up',
  kind: 'fix',
  highlights: [
    "Answers to a robot's questions are hidden from it while they mention a bid it is re-estimating blind — one run this week saw the real number quoted in an old answer before it committed its own.",
    'Robots can now read the robot price book directly, so their rows carry the real book prices instead of hand-mirrored copies.',
    "A robot can add a missing item to its price book in one step, with a mandatory note saying where the price came from — invented prices don't get a door.",
  ],
}

export default note
