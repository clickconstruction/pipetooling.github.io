import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7928',
  date: '2026-11-19',
  title: 'Robots: an assistant can line a bid up for the robots',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now put a bid at the front of the next robot batch, as the robot icon on the Bid Board does, and take it back out.',
    'It can set the axis a practice run of a bid counts toward, and hold a bid out of practice, as the Robots Queue does.',
    'Before anything changes it warns of an axis nobody uses yet, and of anything that would still keep the robots off the bid.',
  ],
}

export default note
