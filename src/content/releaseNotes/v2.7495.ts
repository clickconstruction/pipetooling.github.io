import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7495',
  date: '2026-11-16',
  title: 'Lien desk: Remind texts the leader the link',
  kind: 'feature',
  highlights: [
    'Remind now sends the leader a text too, from the company number. It says who is reminding, what waits, and ends on the link that opens it.',
    'The text goes beside the message on the phone or the email, so a leader who does not open the app is still reached.',
    'The desk says after the press whether a text went. When none did, it says why, like no mobile number on the account or Send texts off.',
    'A send for approval is not texted. A leader outside the Push me hours is not texted either.',
  ],
}

export default note
