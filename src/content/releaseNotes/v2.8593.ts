import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8593',
  date: '2026-11-25',
  title: 'Lien desk: the run says which printed papers have changed since',
  kind: 'feature',
  highlights: [
    'Over Print the run, a card named Changed since printed lists each printed notice or affidavit that would say another thing today.',
    'Each line is one thing that moved, with the value printed and the value now. A notice is read against the bills as they stand.',
    'An affidavit that printed and says the same today no longer prints again with the run. A line under the press says how many.',
    'A paper printed before today kept no values: such an affidavit prints again, and such a notice is read against the notice as stored.',
  ],
}

export default note
