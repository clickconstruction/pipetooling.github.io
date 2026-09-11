import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3314',
  date: '2026-09-11',
  title: 'Routing numbers print whole on the bank transfer card',
  kind: 'fix',
  highlights: [
    'The nine-digit routing number on the statement\'s "Prefer to pay by bank transfer?" card and in the Accounts Receivable panel now reads as one run, the way every bank prints it — it was being split into "0913 1122 9". Account numbers keep their four-digit groups.',
  ],
}

export default note
