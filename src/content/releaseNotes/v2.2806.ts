import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2806',
  date: '2026-09-05',
  title: 'Robots: parallel runs get a dispatcher; a blind run sees only its own bid',
  kind: 'fix',
  highlights: [
    'Several robots can now work one round at the same time: a dispatcher hands each one the next bid nobody has claimed, so two never land on the same job.',
    'A robot asking about its own bid no longer receives every one of its CountTooling projects and another bid\'s question ledger — only the project for that bid.',
    'When a bid has no plan read yet, the robot is told plainly that building it is its own next step, instead of waiting for an extractor that does not exist.',
  ],
}

export default note
