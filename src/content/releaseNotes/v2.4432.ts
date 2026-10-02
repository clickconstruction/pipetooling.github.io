import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4432',
  date: '2026-10-02',
  title: 'Submittals: entering a reviewer’s call says that nobody is emailed',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, typing a reviewer’s call onto a row only records it. Nothing was ever sent, but the window did not say so.',
    'The window now says it: Only for the record. Nobody is emailed or contacted.',
    'Under the box for a new reviewer’s email, it says the email stays in the office. The room uses it to know them if they open it later.',
    'The same line shows on They approved all of it, and the guide says it too.',
  ],
}

export default note
