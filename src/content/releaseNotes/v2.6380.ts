import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6380',
  date: '2026-11-02',
  title: 'Lien desk: a sent notice keeps the job’s money',
  kind: 'fix',
  highlights: [
    'A notice in the Sent pile whose job has dropped off the due-months count read $0 on its row and $0 as its claim, and gate 5 said Nothing billed with Bill the work first, while the bill under it showed what is owed. The desk now reads what the job’s sent bills still owe for such a job, the same way the count does, so the row, the claim and the gate agree with the bills.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
