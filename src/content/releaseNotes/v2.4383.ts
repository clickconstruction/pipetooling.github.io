import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4383',
  date: '2026-10-02',
  title: 'Procurement log: see what blocks ordering and fix it in bulk',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A Before you can order box counts the parts with no lead time, no house or no stage, and names a row with no product yet.',
    'Tick the N ticks those lines. The bar that opens now sets one house, one lead time and one stage on every ticked line.',
    'Lead times make order-by dates appear, so To order can say what to buy first.',
  ],
}

export default note
