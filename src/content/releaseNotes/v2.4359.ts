import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4359',
  date: '2026-10-01',
  title: 'Pipeline: the bill email window and a card’s notes no longer fold the row',
  kind: 'fix',
  highlights: [
    'On a billed Pipeline row, a click on the words of Email this invoice? opened or shut the job’s notes behind it, and so did a click outside it. Now a click outside closes the window only.',
    'With Mobile cards on, a tap inside a job’s open notes folded the card, even in full screen. Now the notes stay open. Tap the card above them to fold it.',
  ],
}

export default note
