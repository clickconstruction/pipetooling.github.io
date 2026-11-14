import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7244',
  date: '2026-11-13',
  title: 'A won bid waits to learn whether it has a job before it offers to open one',
  kind: 'fix',
  highlights: [
    'In Edit Bid, the Job block now checks whether the bid already has a job before it draws its buttons. Until the answer comes back it offers nothing to press.',
    'Before, a bid that had a job showed Open the job, Ask Dispatch to open it or Send to Dispatch for a moment. A press in that moment started a second job for the same bid.',
    'A bid with no job shows the same buttons as before, a moment later. If the check fails, the buttons still appear.',
    'The same holds for the You won it strip in Followup and for a won GC under a bid package. The Bid Board already knows the answer, so nothing changed there.',
  ],
}

export default note
