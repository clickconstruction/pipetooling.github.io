import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4196',
  date: '2026-09-30',
  title: 'The alternate gets an answer: which ones the customer took',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Marking a bid Won now asks which alternates the customer took. Ticked ones fold into the Agreed value; the sent value stays what it was.',
    'Marking a GC’s packet Won asks the same, one yes or no per alternate.',
    'The Bid Board shows the agreed value with a green “alt taken” chip once the customer took one, or “alt declined” when they did not.',
    'A declined alternate’s rows stay on the bid, greyed, and leave the job’s materials, book fill, schedule of values and labor hours.',
  ],
}

export default note
