import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5973',
  date: '2026-10-27',
  title: 'The job window’s card names the customer in full',
  kind: 'fix',
  highlights: [
    'Where it stands names the customer by the name they go by, else their full name. A company is no longer cut to its first word.',
    'A job with nothing written down shows one quiet line instead of three empty ones.',
    'Their word and Our word now read the customer’s own thread, so a promise shows even when no text is tied to the job.',
    'On a phone each label sits over its words, and Read again and Keep as a note are easier to tap.',
  ],
}

export default note
