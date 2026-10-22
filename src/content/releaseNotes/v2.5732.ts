import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5732',
  date: '2026-10-22',
  title: 'Bids: the robot icon is a ring that fills, and its sheet shows the steps',
  kind: 'feature',
  highlights: [
    'The robot icon on the Bid Board is now a ring of seven segments, one per step of the robot’s work. It fills as the robot goes, and the segment it is on fills by the sheets it has read. Hover and it says the step in words, with when the robot last spoke.',
    'Tap the icon and the sheet draws the same seven steps as a bar, with the last word and the Mac it came from. Read the run lists every signal the robot sent on that bid. Leave this one to me takes the bid off the robots within five minutes.',
    'The Robot Board row and the Robots lenses say the same thing: which sheet the robot is reading, and when the robots last checked in. A robot that goes quiet on a bid for ten minutes turns amber.',
  ],
}

export default note
