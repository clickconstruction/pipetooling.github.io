import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8409',
  date: '2026-11-23',
  title: 'Supply houses: one box searches every bill',
  kind: 'feature',
  highlights: [
    'Materials, Supply houses has a new box, Search every bill. Type an invoice number, a supply house, a PO, an amount, a day or a part printed on a bill.',
    'Each bill found shows its supply house, its day, its amount and the jobs it is on. A bill found by a part says On the paper and shows the line.',
    'Press a bill’s number to open it over the page, with the bills you found beside it. The link icon copies a link to it.',
    'The search is exact. A part is found on the bills whose lines the app has read, about nine in ten.',
  ],
}

export default note
