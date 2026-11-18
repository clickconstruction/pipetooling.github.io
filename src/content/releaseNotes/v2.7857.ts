import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7857',
  date: '2026-11-18',
  title: 'Pricing calculator: send the answer to a row, or make a new row from it',
  kind: 'feature',
  highlights: [
    'The calculator on Bids → Pricing has two new buttons under its display: Put on a row… and Make a new row….',
    'Each one opens a window with the number in it and the row drawn as the table will show it. Nothing changes until you press the window’s button.',
    'Put on a row… lists the bid’s rows. The number becomes the row’s whole price, spread over its count.',
    'Make a new row… asks for a name and adds the row at the end of the table.',
  ],
}

export default note
