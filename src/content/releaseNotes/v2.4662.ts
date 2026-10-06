import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4662',
  date: '2026-10-05',
  title: 'Legal portal: an email to the law firm that fails is tried again and shown',
  kind: 'fix',
  highlights: [
    'When an email to someone at the law firm does not go, it is tried again every five minutes for an hour. The others are not sent it twice.',
    'The Legal desk’s Firm’s emails marks that person not reaching, with since when and what the mail service said. The header button counts them.',
    'The firm sees the same line against the person on its portal’s Notifications page.',
    'The Stop these emails link now works in every email, not only the newest one.',
  ],
}

export default note
