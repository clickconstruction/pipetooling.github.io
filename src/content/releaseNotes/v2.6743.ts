import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6743',
  date: '2026-11-08',
  title: 'Materials on site: a job with more than 5,000 ledger rows sums right',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The materials desk, a job’s Materials page, the Job window’s tab, the Pipeline tools menu’s count and the Needs you lines read a job’s cages and boxes from its ledger. A job past 5,000 ledger rows was summed from a part of it and said nothing. Now the database sums the whole ledger for such a job, and the page says so.',
    'On a job that large, History and the boxes show the newest 5,000 rows, the counts that reset each line among them, instead of the oldest.',
    'No job is near that size today; the change is there before one is.',
  ],
}

export default note
