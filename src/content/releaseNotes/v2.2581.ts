import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2581',
  date: '2026-09-01',
  title: 'AR customer rows show the whole name',
  kind: 'feature',
  highlights: [
    'In the Accounts Receivable Customers view, each row now puts the customer name on its own line with the Comm/Res tag and chase pill ("Owes a call", promises) beneath it — long names like "Southern Post Construction" no longer truncate to a few letters.',
    'Hovering a name that still overflows shows the full name in a tooltip.',
  ],
}

export default note
