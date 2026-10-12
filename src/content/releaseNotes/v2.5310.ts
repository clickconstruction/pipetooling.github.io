import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5310',
  date: '2026-10-13',
  title: 'Customers: merging a duplicate keeps its GC call log and its projects',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant'],
  highlights: [
    'Merging two customers used to drop the duplicate’s GC call log. Every call, text, email and note now moves to the customer you keep, still naming the job it was about.',
    'A GC project that named the duplicate as its architect or its property owner now names the customer you keep instead of losing the link.',
    'Everything the merge already moved, bids, jobs, estimates, projects and the people at the customer, moves as before.',
    'The change is a database migration; it takes effect once the lead pushes it.',
  ],
}

export default note
