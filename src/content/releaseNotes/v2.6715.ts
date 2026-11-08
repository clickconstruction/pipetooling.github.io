import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6715',
  date: '2026-11-08',
  title: 'A mail conversation onto an HR file: the dev seat lands a thread as dated entries on a person',
  kind: 'feature',
  highlights: [
    'The dev seat’s mail tag now takes a person as its target. Each mail of a Gmail conversation becomes an entry on that person’s HR file, on the day it was sent, with who wrote it, who got it, the subject, the files by name and size, and the words as plain text.',
    'Every such entry remembers the mail it came from, so tagging the same conversation again adds only what the file has not seen, and a dev can read the mail back from the entry.',
    'Later mail in the conversation lands on the file by itself, as it does for a job, until the seat lifts the follow. The mail’s files stay in Gmail unless filed as evidence.',
    'The Timeline on People → HR shows the entries as conversations, and the case search finds a phrase from a mail’s words.',
  ],
}

export default note
