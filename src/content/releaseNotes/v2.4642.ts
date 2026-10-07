import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4642',
  date: '2026-10-05',
  title: 'Legal portal: the firm reads the contact log about its own matter',
  kind: 'fix',
  highlights: [
    'The attorney\'s portal no longer shows contact log entries about the customer\'s other jobs.',
    'An entry that names one of the referred jobs by number goes to the firm. An entry that names no job goes as account history.',
    'The Legal desk still shows the whole log to the office.',
  ],
}

export default note
