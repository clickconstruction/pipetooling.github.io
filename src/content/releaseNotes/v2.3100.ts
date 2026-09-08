import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3100',
  date: '2026-09-08',
  title: 'Bill tab: each line item says whether it is a stage — Order, Any, or a plain line',
  kind: 'feature',
  highlights: [
    'Under every line item in ① Line Items, pick Order (a numbered stage that waits for the one above it), Any (its own dates, bills when done), or — (a plain line). The badge at the left shows the number, a diamond, or nothing, and the rest of the line says where the work and its draw stand.',
    'The ② Invoices strip runs in stage order and colors each block by its draw: paid, billed, drafted, ready to bill, waits on its stage, later. Nothing bills out of order.',
    'A new "Still to bill" list under the strip shows every line item with money left and what it is waiting on; a row that is ready gets a Bill it button that breaks off exactly that invoice. Invoices name the draw they are — "Draw 2 · Top-out".',
    'Every existing line item reads as Any until you flip it. Jobs with no Order rows bill exactly as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note
