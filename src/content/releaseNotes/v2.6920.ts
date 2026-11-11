import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6920',
  date: '2026-11-10',
  title: 'Price sheets on the Parts Book, and a quote that came twice',
  kind: 'feature',
  highlights: [
    'The Parts Book has the Price sheet press too. Drop a supply house’s general list there and it files part prices, with no bid.',
    'All price sheets lists every sheet that was read, how many rows are filed and how many wait. Open any one where it was left.',
    'When a house sends a later copy of a quote, the sheet says what moved: how many prices changed, and which rows are new or gone.',
  ],
}

export default note
