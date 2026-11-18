import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7769',
  date: '2026-11-18',
  title: 'Trips: a job billed from the GC desk sends an Extra trip to a change order',
  kind: 'feature',
  highlights: [
    'On a job we build as the general contractor, the customer’s price is the contract. It grows only by a signed change order. So Put on a bill no longer offers that job for a trip’s line.',
    'The window now says so under Job, in words, and tells you to put the trip’s amount on a change order.',
    'A leader, the controller or a dev gets Open Change orders there, which opens that project’s change orders on the GC desk. Everyone else is told who writes the change order.',
    'A trip with another job still goes on that job’s lines as before.',
  ],
}

export default note
