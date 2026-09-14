import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3449',
  date: '2026-09-14',
  title: 'Pipeline: the line under the bar stops repeating the money',
  kind: 'fix',
  highlights: [
    'The sentence under a job’s bar now says the stage, who was on site and when, and the percent with its date — and stops there. The money it used to repeat (paid, billed, done-not-billed) is already spelled out in the rows directly beneath it.',
    'That halves the sentence, so it fits the column instead of being cut off: on today’s board 4 rows are trimmed where 40 were.',
    'Hovering the bar still shows the whole sentence, money included, and the colour of the line still turns amber when money is owed and green when the job is paid in full.',
  ],
}

export default note
