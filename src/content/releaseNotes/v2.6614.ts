import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6614',
  date: '2026-11-07',
  title: "Documents on a person's HR file: named documents beside the summary and narrative, added from a file",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The HR file's documents view is now Documents: the summary and narrative the agent keeps sit at the top, and any number of named documents follow, each with a title, a counsel-only mark where it needs one, and its own history of prior versions.",
    'Add a document three ways: write it, pick a markdown or plain text file off your desk, or paste text. A file is read in your browser and saved in one press, so a long document never travels through an agent or an email.',
    'Open a document to read it with a Jump to list of its sections, edit it in the same box as the summary, or copy its whole text; a counsel-only document has no copy press. The agent edits named documents too, a section at a time.',
  ],
}

export default note
