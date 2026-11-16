import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7478',
  date: '2026-11-16',
  title: 'Lien desk: a retainage notice tells the leader',
  kind: 'fix',
  highlights: [
    'Asking the leader to approve a retainage notice now tells the leader, on the phone or by email. Before, the press told nobody and the paper waited until the leader opened the desk.',
    'Remind now takes a retainage notice that waits for approval. Before, the press left it out and said it had no message yet.',
    'The message names the job, the retainage and who holds it, and the day to mail by. Its tap opens the Retainage notices list on that job.',
    'When the message does not go, the desk says so in amber with the reason. The paper is still sent.',
  ],
}

export default note
