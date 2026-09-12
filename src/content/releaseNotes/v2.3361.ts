import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3361',
  date: '2026-09-12',
  title: 'The job window’s Costs tab, told straight',
  kind: 'feature',
  highlights: [
    'The Costs tab now leads with four numbers that are always true: true margin at completion, spent so far, earned so far (% done × the price), and time left at the current pace. Nothing is measured against an assumed budget any more.',
    'Click the margin tile to see how it builds by section — labor, materials, subs, other — with what the bid carried beside each, then overhead, true cost, price and margin as the sum.',
    'A baseline strip says what the job has taken so far (hours, hours per $1k, average wage, people, materials) when the bid was sent without hours, and reads the hours against the bid when it carried them.',
    'One chart (cost against value earned), one "where the money went" table with each source’s share, and the daily spend and the emoji timeline folded behind a toggle.',
  ],
}

export default note
