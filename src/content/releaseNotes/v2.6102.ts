import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6102',
  date: '2026-10-29',
  title: 'The lien path on a job with no GC no longer names a § 53.056 notice as the next step',
  kind: 'fix',
  highlights: [
    'On a job where our contract is with the owner, the lien timeline drew the § 53.056 row as not required, yet Next on the path above it said to draft that month’s notice and Waiting on said the notice was to be drafted and mailed. The path now agrees with the row: the next step is the § 53.057 retainage notice when the contract-end day is set, else the affidavit.',
    'Every place that draws the path reads the fix: the Lien window’s strip, the Lien desk’s Timeline tab, the Legal desk’s Paper tab, the firm’s portal and both printed packets.',
    'The Lien desk’s due lens and the firm’s portal grid list a job with the owner when its affidavit or § 53.057 notice is inside the 30-day lead, no longer for a month’s notice it does not owe.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
