import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4273',
  date: '2026-09-30',
  title: 'Accounts Receivable: the search finds a cheque that was already applied',
  kind: 'feature',
  highlights: [
    'Searching the deposit list while To match is showing now also looks in All. A cheque that was already applied, marked returned or closed out shows under “Nothing to match · found in All” instead of “No bank transactions match this search”.',
    'When the pile has hits too, the All rows follow them under “Also found in All”. A row found there opens like any other: the bills it paid, and the job.',
    'Only when neither list has it does the search say so: “not in All either”.',
  ],
}

export default note
