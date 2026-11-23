import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8331',
  date: '2026-11-23',
  title: 'Dashboard: the office’s round is a week you can see',
  kind: 'feature',
  highlights: [
    'The office’s round card now draws the last five workdays and today. Each day the round ran is a bar, with the stations looked at and who ran it under it.',
    'A workday with no round is an empty cell that reads missed. The card used to say it three ways, in a chip, a line and a sentence.',
    'One missed workday shows in amber. The card turns red only after three in a row.',
    'One small press sits at the bottom right. Start the round opens the station today’s round starts on.',
  ],
}

export default note
