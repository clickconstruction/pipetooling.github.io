import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5671',
  date: '2026-10-20',
  title: 'Pricing: a price card you just opened reads … until its prices arrive',
  kind: 'fix',
  highlights: [
    'Right after you click a price card, the Revenue, Profit and Margin at the top and each row’s price read … until that price’s numbers arrive. Before, they showed $0 and blank rows for a moment.',
    'A price change made in that moment waits and tells you to try again. Before, it could use the other price’s book, so Fill matching from book could point the new price at the old price’s entry.',
    'If a price’s numbers fail to load, the error shows and the Workbench no longer stays on ….',
  ],
}

export default note
