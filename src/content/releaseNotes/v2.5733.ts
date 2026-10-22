import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5733',
  date: '2026-10-22',
  title: 'Robots: the Console says which robot is alive, when it checked in, and what it did',
  kind: 'feature',
  highlights: [
    'The Console’s new Rounds card shows one row per robot key: Alive, Quiet or Asleep, when it last checked in, what it has in hand right now, and the last five things it finished, each a door to the bid.',
    'Stop the rounds on a row tells that Mac to finish the bid in hand and claim no more. Start again brings the next round within five minutes. The stop never touches a session a person started by hand.',
    'The row’s word is the robot’s own: it reads Stopping after a bid until the robot says it has stopped.',
  ],
}

export default note
