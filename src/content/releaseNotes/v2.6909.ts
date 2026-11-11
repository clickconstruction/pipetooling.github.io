import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6909',
  date: '2026-11-11',
  title: 'A PDF that Apple Mail places in the body of a mail counts as a file',
  kind: 'fix',
  highlights: [
    'Apple Mail puts an attached PDF inside the body of the mail. An agent on the dev seat could see such a file listed on a mail, but could not read it or file it on a job.',
    'It can now read and file it like any other attachment. A signature’s small logo is still left out.',
    'When a conversation is tagged onto a person’s HR file from My email, a PDF placed in the body is now counted and named on the entry too.',
  ],
}

export default note
