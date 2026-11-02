import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6310',
  date: '2026-11-01',
  title: 'Sent copies: a heading per day, the job each copy is for, and a coloured kind tag',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Documents → Sent copies lists under one band per day, Today, Yesterday, then the day, with a count. Each row carries only the time.',
    'The title sits on its own line with the facts under it: how it went, the time, to whom, by whom. Attachments are chips. The job or bid the copy is for is a green link, and the subject shows when it says more than the title.',
    'A tag before each title names the kind of paper in its group’s colour: bills green, lien and legal red, contracts and estimates blue, bids and suppliers violet, statements and reports amber. The filter chips wear the same colours.',
    'A read that fails now says so with Retry instead of reading as an empty ledger.',
  ],
}

export default note
