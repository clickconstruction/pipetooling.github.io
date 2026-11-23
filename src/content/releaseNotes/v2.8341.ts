import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8341',
  date: '2026-11-23',
  title: 'Lien desk on a phone: every To do row has one button at the right, the same size',
  kind: 'feature',
  highlights: [
    'On a phone, a To do row now has its words at the left and one button at the right. The button is the same width on every row and 44 px tall. It was as wide as its words, on a line of its own, and 40 px tall.',
    'A row’s second way out, like Not lienable… or Take back…, is a blue line under the words. It used to take the main button’s place and push it to the left.',
    'Three long buttons have shorter names on a phone: Answer it, Open the record and Fix the record. The line above each says which question or record.',
    'Rows with no day set are one group at the end of the list. No day set was a heading twice. On the Board’s tiles, the day and its counts are on two lines, and Show them › ends the line it belongs to.',
  ],
}

export default note
