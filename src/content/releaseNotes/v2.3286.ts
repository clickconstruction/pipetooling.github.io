import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3286',
  date: '2026-09-11',
  title: 'Call mode promises carry who said it',
  kind: 'feature',
  highlights: [
    'When a call ends with a promised date, the promise is now recorded the same way as "They said…" on the Billed row: as a phone promise, with who at the customer said it, so the customer\'s record reads "by Dana by phone to Taunya".',
    'Call mode and the Dashboard AR call card gain a small "Who said it" box next to the note — optional; leave it blank and the promise still records as a call.',
    'Nothing else about the call changes: the note still saves with whichever button you tap, and the chase queue still counts the promise for its broken-promise escalation.',
  ],
}

export default note
