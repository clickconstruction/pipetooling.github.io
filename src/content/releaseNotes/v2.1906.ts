import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1906',
  date: '2026-08-20',
  title: 'Pricing: try the new Workbench',
  kind: 'feature',
  highlights: [
    'The Pricing tab now has Old and New pills. Old is the grid you know; New is the Workbench — your Revenue, Cost, Profit, and Margin stay on screen while you price.',
    'Set a target: drag the blended-margin slider or type the total you want to bid, and the Workbench prices every row to hit it — spreading fairly by cost, holding 📌-pinned and fixed-price rows, and never touching rows without costs.',
    'Everything previews first in amber — Apply writes it, Discard walks away. A coverage bar shows what is still unpriced, and "Where the profit lives" warns when too much profit rides on one or two items.',
    'Old stays the default while the Workbench is refined — flip any time, same data underneath.',
  ],
}

export default note
