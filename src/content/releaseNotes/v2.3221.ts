import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3221',
  date: '2026-09-10',
  title: 'The robot Scoreboard, for estimators',
  kind: 'feature',
  highlights: [
    'Bids → 🤖 Robots → Scoreboard is open to everyone who can audit a robot bid, not just the developer. It starts with the rule in plain words — a job type is ready for robot first drafts when the robot lands within 8% of our number five times in a row — and the last five scored runs.',
    'A “Your part” strip says what is yours to do: the robot’s sealed numbers on your bids and when they score, your bids that are queued, the live bids the robots can’t see yet and why, and the audits and questions waiting on anyone — each with a door.',
    'Job types read like a person would say them (Vet clinic, Fitness club finish-out, Oil-change franchise), ranked closest to ready first, with the last five runs as high / low percentages and one line on what the robot learned from the last audit and who taught it.',
    'The Shadows view folded into the Scoreboard: every sealed run on a live bid sits at the top with the sealed-envelope steps a click away, and the practice runs on past bids sit under it. Old Shadows links land on the Scoreboard.',
  ],
}

export default note
