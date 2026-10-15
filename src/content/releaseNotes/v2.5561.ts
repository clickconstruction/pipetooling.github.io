import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5561',
  date: '2026-10-15',
  title: 'Prospects → Jobs to GC: the jobs on the card, and Asked us ✓ opens New project filled in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A lead’s card carries its jobs: press + Add a job with the job, the address, the size, when bids are due and where the plans are. Each row reads the bid day and the days left; Lost asks who won, Drop and Reopen keep the list honest.',
    'The queue has a third order on Jobs to GC, Soonest bid: the lead whose job bids soonest first, then never called, then coldest. A strip over the deck counts the GC work in flight from the Project Board.',
    'Asked us ✓ makes the customer, marks the soonest job asked and opens New project on GC projects with the job filled in. A lead already linked to a customer uses that record; New Prospect offers the link when the company is already a customer.',
    'On GC projects, a lost project’s card has Send the owner back to Prospects: the owner lands on Jobs to GC with the job marked lost and who won in the note, so the next call is on the deck.',
  ],
}

export default note
