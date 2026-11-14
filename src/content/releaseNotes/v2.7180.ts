import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7180',
  date: '2026-11-13',
  title: 'Lien desk: an affidavit sent for approval tells the leader',
  kind: 'feature',
  highlights: [
    'When the office sends an affidavit for approval, the leader’s phone gets one line: the job and the last day to file. With no phone set up, the same line goes by email. A notice already did this, and an affidavit told nobody.',
    'Send N for approval on the Affidavits list sends one message for the whole batch. Twelve affidavits are one message that names the count and the soonest day to file, never twelve.',
    'The desk says which way it reached the leader. If the message could not go, the affidavit is still sent, and the desk says the leader was not told and why.',
    'A link to one affidavit now opens the Affidavits list on that paper.',
  ],
}

export default note
