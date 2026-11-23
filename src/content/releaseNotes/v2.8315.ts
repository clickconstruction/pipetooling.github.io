import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8315',
  date: '2026-11-22',
  title: 'Lien grid: Paid out to GC and 10 % reserved read the owner’s call',
  kind: 'fix',
  highlights: [
    'When an owner calls about a lien letter and you record the answers, the lien grid now shows them. Paid out to GC reads yes, or no with the dollars still owed. 10 % reserved reads held, released or never.',
    'Both columns were blank before, on the grid the office prints and on the firm’s portal, whatever the owner had said.',
    'The firm sees the two answers and the dollars the owner still owes the GC. It does not see your note on the call or who took it.',
    'On the firm’s portal, an account whose general contractor is not the customer who owes now reads that contractor’s name. It read the word GC before.',
  ],
}

export default note
