import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6157',
  date: '2026-10-30',
  title: 'The sub’s Owed to you as rows under two bands, a prototype, and a chip that names its day (punch list #217)',
  kind: 'feature',
  highlights: [
    'A job card’s chip on the sub’s portal now names the day its money is queued for: Queued for Fri Oct 30 when it is in the next pay run, Queued for Dec 15 when it comes later. A card and the head no longer disagree.',
    'Add ?shape=1 to a portal link to see Owed to you as its rows: a band for the next pay run with its day and the jobs in it, then a Later band in payable-after order.',
    'On the sample sub’s portal, or as a dev, ?sbs=1 shows today’s head over the rows. Show me on their portal carries the flag along.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor'],
}

export default note
