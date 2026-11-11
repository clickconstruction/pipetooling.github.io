import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6949',
  date: '2026-11-11',
  title: 'An agent on the dev seat can add a line or change a sentence in a long document without resending the section',
  kind: 'feature',
  highlights: [
    'An agent can now put new lines straight under a heading, above what is already there. A log kept newest first takes its new line this way.',
    'An agent can now swap one exact sentence or phrase inside a section. The change is refused when the words are missing or appear more than once, so it never lands in the wrong place.',
    'Neither change sends the rest of the section again, so nobody retypes another person’s words to add one line. The plan shows exactly what is removed and what is added.',
    'A section sent back as it was read no longer gains an empty line.',
  ],
}

export default note
