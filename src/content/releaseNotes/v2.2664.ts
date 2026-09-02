import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2664',
  date: '2026-09-02',
  title: 'The lien notice email joins the email index',
  kind: 'fix',
  highlights: [
    'Settings → Email templates now lists the § 53.056 notice-of-claim email (the courtesy send beside certified mail) — it was missing from the outbound-email index.',
    'The group is renamed "Lien paperwork" since it now covers more than releases, and notice sends are tagged in the email log so per-type send stats pick them up.',
  ],
}

export default note
