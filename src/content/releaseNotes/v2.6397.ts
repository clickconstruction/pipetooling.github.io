import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6397',
  date: '2026-11-02',
  title: 'A warranty in place of a contract: the paper and the step exist',
  kind: 'feature',
  highlights: [
    'A job agreement is now a contract or a warranty: the warranty the office sends a homeowner when a contract would put them off, which binds both sides because the customer initials each line and certifies the work on it. The job’s activity says Warranty where it said Contract.',
    'The residential customer flow has a Warranty step, aside from the lane like the GC customer’s change orders: it shows only while a warranty is out to sign or signed, so a homeowner with no warranty never stands on it. Its reminder stays off until the owner turns it on.',
    'This release lays the ground only. The Contract window’s Warranty pick, the signing page’s initial boxes and the thread’s warranty link follow in the next two releases.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
