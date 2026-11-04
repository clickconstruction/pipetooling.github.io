import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6508',
  date: '2026-11-04',
  title: 'A web address in an email’s words is one press, and the sender’s bold reads bold',
  kind: 'feature',
  highlights: [
    'In Messages, a web address in an email’s words is blue with a small link mark beside it. Press it once and it opens in a new tab. Before, the address was plain words to copy and paste, like the Box link to the plans in an invitation to bid. A mail program that writes the address twice, once in angle brackets, shows it once.',
    'Words the sender made bold read bold, with the stars around them gone. The thread’s line, the message window and its print page all read this way. Copy still copies the words as they came.',
    'Under Attachments, Open sits right after the file’s name instead of at the window’s far edge, and a link’s row carries the same link mark as the words, which says what it is when you rest on it. The blue arrow square is gone.',
    'Reading an email as rich text, in the sender’s own layout, waits on a decision: the app keeps an email’s words as text and not its HTML. Punch list #259 holds the call for the owner.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
