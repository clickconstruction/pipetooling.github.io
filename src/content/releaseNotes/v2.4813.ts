import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4813',
  date: '2026-10-07',
  title: 'Customer timeline: a customer’s whole story on one page',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Click a customer’s name on the Pipeline and press Timeline. Every job is a colored rail from its first record to its final payment, with today at the top.',
    'Bills, payments with their deposits, promises and notices sit on the left. Crew hours, reports, tests and supply tickets sit on the right.',
    'The bar at the top says what they owe us, what is not billed yet, and the hours and materials on jobs not paid in full. Scroll back and it says what stood on that day.',
    'Press a job’s chip to fade the rest, or show only the money or only the field. The window remembers Profile or Timeline on each device.',
  ],
}

export default note
