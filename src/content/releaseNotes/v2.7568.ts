import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7568',
  date: '2026-11-17',
  title: 'Dashboard: the office sees what waits on the leader, and can remind him',
  kind: 'feature',
  highlights: [
    'An assistant’s Dashboard has a new card under Needs you, named for the leader, like Waiting on Marcus. It lists what only the leader can do: lien notices to approve and to sign, lien waivers, tagged job notes and the weekly line budgets.',
    'A lien row has Remind. It sends the same message the Lien desk’s reminder sends, to the leader’s phone or by email, and then says what went and what did not.',
    'A waiver, a tagged note and the line budgets have no reminder yet. The row says so, and Open the job takes you to the job.',
    'When a notice waits on a signature and the leader is beside you, one button opens the approved notices, where the signing code is typed.',
  ],
}

export default note
