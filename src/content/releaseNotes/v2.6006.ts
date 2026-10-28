import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6006',
  date: '2026-10-28',
  title: 'Print it again on a held waiver records cleanly; the lien push dates an evening signature on its own day',
  kind: 'fix',
  highlights: [
    'Release of Lien: on a waiver out for a notary, Print it again prints the notary page again, files the copy, and keeps the hold with the new print day. It no longer says the hold was not recorded.',
    'A leader’s push about a lien notice or waiver signed with his code, or a pen signature the office recorded, names the day he signed in Central time. A signature after 7 PM was dated tomorrow.',
    'Once the notarized PDF is on the record, step 5’s summary says before a notary, without in ink, the way the record sentence and the email already do.',
  ],
}

export default note
