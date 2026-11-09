import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6739',
  date: '2026-11-08',
  title: 'The Development page’s Money look reads the pace of its own payers',
  kind: 'fix',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'The expected pay day on a billed job used to read every billed customer’s pace on every open of the page and keep one or two. Now the page asks for the site’s payers alone, the GC where there is one.',
    'The day reads the same: a payer with too few payments of its own still borrows the GC pace, the segment median or the company median, which come down with it.',
    'The Pipeline and the Collect desk read the whole list as before.',
  ],
}

export default note
