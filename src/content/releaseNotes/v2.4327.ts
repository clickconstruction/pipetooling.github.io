import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4327',
  date: '2026-10-01',
  title: 'Procurement log: a line for every part, and To order first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A row with parts gets a line per part on the procurement log, with its own house, lead time, stage, order date and PO. Qty says how many to order.',
    'To order, By tag and By house choose how the log reads. To order puts what to buy now first, by house, the soonest order-by date first.',
    'Tick the lines on one order and mark them ordered with one date and one PO. Mark delivered works the same way.',
    'Order-only parts stay off the printed sheet, the updates and the GC’s room card. The CSV keeps them, marked.',
  ],
}

export default note
