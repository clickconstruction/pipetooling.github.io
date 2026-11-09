import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6760',
  date: '2026-11-08',
  title: 'The billing notification lists, the Stripe links and projections open to the controller; GC Review’s standing copies, the paid-in-full email and the travel hints to the office',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The controller opens the Ready to Bill, Paid, Paid in Full and Estimate accepted notification windows beside the owner, and edits who is on each list. Before, only a dev could change a list.',
    'The controller sees Open in Stripe Dashboard on a Stripe bill, and edits a project’s money projections and the Forecast’s money column.',
    'Any office role sets GC Review’s standing copies, sends the paid-in-full email from a job window and draws the dispatch board’s travel hints.',
  ],
}

export default note
