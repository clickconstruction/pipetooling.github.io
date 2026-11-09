import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6817',
  date: '2026-11-09',
  title: 'Every supply house bill’s lines will be rows: the tables, the check and the wider reader',
  kind: 'feature',
  highlights: [
    'The database now has a place for every line of every paper a supply house sends: the house’s own part code, the description as printed, the unit, the quantities ordered, shipped and back ordered, the unit price with every decimal the paper prints and what it is per (each, per hundred, per thousand), and the extension. A kit’s components are kept under their kit and never counted twice.',
    'A paper counts as a purchase only when its lines add up: each line’s quantity times its price meets its extension, the lines meet the subtotal, the subtotal with tax and freight meets the total, and the total meets the amount on the bill’s row. One that is off keeps its lines and waits for a person to look.',
    'The bill reader now asks the paper for those columns, reads a ship ticket, an acknowledgement, a quote or a bid as what it is, and carries the supplier’s order number that ties them to the invoice. The Add invoice window fills exactly as before.',
    'Nothing shows on a screen yet. The sweep that reads the bills already on file, the match to the parts book and the What we buy page come in the next steps.',
  ],
}

export default note
