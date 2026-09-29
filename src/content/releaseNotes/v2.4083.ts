import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4083',
  date: '2026-09-28',
  title: 'Submittals: the procurement log — released, ordered, lead times, and when it lands',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Bids → Submittals has an eighth stage, Procure: the procurement log a GC asks for, one row per submittal tag. Released comes from the review room’s approval, expected from the order date plus the lead time on the pick, required from the job’s stage windows through the takeoff’s stage. You type the order date and PO, the house’s own arrival date when it differs, the delivered date and a note.',
    'Each row says its float against the stage it is needed for — in the red when it lands late — and, for a released row not yet ordered, the last safe order date. Long-lead items with no cut sheet (a grease interceptor, a lift station) get a hand row.',
    'Send update records a dated update with what changed since the last one, opens the sheet to print or save as a PDF (changed rows first, with the one line you wrote), and copies the text to paste into your email to the GC. Updates sent lists every one and reopens it.',
  ],
}

export default note
