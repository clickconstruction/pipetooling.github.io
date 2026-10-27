import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6001',
  date: '2026-10-27',
  title: 'Pricing: a price you type as 0 is saved as $0.00',
  kind: 'fix',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On Bids → Pricing, typing 0 into a row\'s sale price now saves it. The cell reads $0.00, the row counts as priced, and its revenue, the strip and the breakdowns drop to zero. Before, a 0 was thrown away as if nothing had been typed, and the old price came back.',
    'Typing 0 into a row\'s Revenue does the same. A row with no price at all still shows a dash, and "Show unpriced only" still finds it.',
    'Wendi asked on 2026-10-27, trying to set WS - FIXTURE to zero: "Why can\'t I make something zero? Have seen this bug before." Since August the Workbench had read a zero as no price at all, so one could never be saved.',
  ],
}

export default note
