import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6205',
  date: '2026-10-30',
  title: 'History on a Development page: a searchable About picker, the box folded, a spyglass on the search',
  kind: 'feature',
  highlights: [
    'The About picker in the History box is searchable. Press it and type a number or a name to find a job, a bid or the customer. Jobs and bids list newest first with their stage, and the pieces written about last sit near the top.',
    'Narrow History to one piece with its amber chip and the About picker follows it, so the line you write lands on that piece.',
    'The box for writing a line is folded by default. Press Write a line to open it and Close to fold it; the lines read first.',
    'The History search box carries a spyglass, so it reads as a search before a word is typed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
