import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4087',
  date: '2026-09-28',
  title: 'The submittal room shows the GC the procurement log',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The GC’s review room link now carries a Procurement card under the rows: every released, ordered or delivered tag with its status, when it lands and when its stage needs it — on time, late by so many days, or on site — and when you last sent an update.',
    'Status and dates only. The PO and the supply house stay on your screen; a row still awaiting review is not on the card.',
    'It reads the same log you keep on Submittals → Procure, so what the GC sees is what you see, without sending anything.',
  ],
}

export default note
