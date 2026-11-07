import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6613',
  date: '2026-11-07',
  title: "Named documents on a person's HR file, from the dev seat",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "A person's HR file can now hold any number of titled documents beside the summary and the narrative: markdown or plain text, each with its own history of prior versions, and a counsel-only mark for one kept inside the circle.",
    'The dev seat makes one by title, edits one by its id with the same section ops as the summary and narrative, marks or archives it, and lists them with their size and sections; a save over a version kept since is refused as before.',
    'The Documents view in People → HR, with Add a document from a file, is the next change.',
  ],
}

export default note
