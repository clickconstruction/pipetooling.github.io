import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6622',
  date: '2026-11-07',
  title: "What moved on a person's HR document, from the dev seat",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now list a document's prior versions, who kept each and when, and show the difference between any two of them, or between one and the text as it stands, as the lines removed and added.",
    'The HR file read marks which named documents changed since a day you give, so an agent updating the record starts from what moved.',
    'The two versions are compared on the server; only the difference travels.',
  ],
}

export default note
