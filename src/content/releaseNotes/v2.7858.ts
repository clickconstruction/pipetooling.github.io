import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7858',
  date: '2026-11-18',
  title: 'Pricing calculator: drag a row or a breakdown line onto it',
  kind: 'feature',
  highlights: [
    'While the calculator is open on Bids → Pricing, each row and each Kind breakdown line shows a grip. Drag one onto the calculator.',
    'The calculator asks which number you want from the line, such as its revenue or its count, and puts it on the display with its name.',
    'The tape prints the name in the math, like Pipe revenue × 0.4.',
    'When the math is a group’s revenue or cost times one number, Make a new row… makes a row that follows that group.',
  ],
}

export default note
