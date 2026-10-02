import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4369',
  date: '2026-10-02',
  title: 'Accounts Receivable: Book it as Income',
  kind: 'feature',
  highlights: [
    'A deposit that paid a bill but that Banking books as an expense now says so, with one button: Book it as Income.',
    'It names the Banking rule that labelled it, so the rule can be limited to money going out.',
    'If the payment comes off later, the old label goes back.',
  ],
}

export default note
