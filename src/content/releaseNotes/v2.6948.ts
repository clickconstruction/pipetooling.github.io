import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6948',
  date: '2026-11-11',
  title: 'A note the dev seat plans on a bid with no date can now be written',
  kind: 'fix',
  highlights: [
    'An agent on the dev seat plans a note, reads the plan, then writes it. A note on a bid with no day named was refused every time, with a message that the bid had changed when it had not. It now goes through, stamped with the time it is written.',
    'The same fault stopped the agent from archiving a named document on a person’s HR file. That works now too.',
    'Nothing changes for notes typed in the app, or for a note that names its day.',
  ],
}

export default note
