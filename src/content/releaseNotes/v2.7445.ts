import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7445',
  date: '2026-11-16',
  title: 'Lien desk: the leader’s message goes whoever in the office presses',
  kind: 'fix',
  highlights: [
    'Send for approval and Remind now reach the leader whoever in the office presses. Before, only the person who first saved the draft could tell the leader, and anyone else’s message was refused.',
    'When the message does not go, the desk says so in amber with the reason, and says to tell the leader another way. The paper is still sent. Before, the desk said the leader would see it on the Dashboard and gave no sign.',
    'Remind now reaches the leader for an affidavit sent days ago. Before, the reminder for an older affidavit sent nothing and the desk counted it as sent.',
    'A reminder counts only when a message went. One that did not go is named with its reason, and the reminder email says it is a reminder and who pressed.',
  ],
}

export default note
