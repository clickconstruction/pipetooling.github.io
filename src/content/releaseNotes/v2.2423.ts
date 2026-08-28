import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2423',
  date: '2026-08-28',
  title: 'The Workbench shows the multiple',
  kind: 'feature',
  highlights: [
    'A fourth stat in the Pricing header: MULTIPLE — the bid\'s revenue as a multiple of cost, to one decimal ("2.2×"), updating live beside Revenue, Profit and Margin.',
    'Hover shows the math (revenue ÷ our cost); it reads "—" until the bid has both a cost and a price.',
  ],
}

export default note
