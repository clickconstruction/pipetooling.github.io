import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6027',
  date: '2026-10-28',
  title: 'A retainage release paid by a recorded payment clears its line',
  kind: 'fix',
  highlights: [
    'The Retainage held line on Accounts Receivable, the lien details and the Lien desk now read a release bill the way the Bill tab does: paid once the payments recorded on it cover it, not only when the bill is stamped paid. A release bill paid by a check typed in by hand clears the line; a part payment leaves it as release billed · awaiting payment.',
    'The same reading covers the final pay application’s bill on a job with pay applications.',
  ],
}

export default note
