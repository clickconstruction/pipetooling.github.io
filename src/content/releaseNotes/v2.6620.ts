import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6620',
  date: '2026-11-07',
  title: "One search across a person's case, from the dev seat",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now search a person's whole case in one call: the HR entries, the evidence memos, every named document and the summary and narrative section by section, and the matter's narrative, entries and papers.",
    'A hit says where it sits, down to the section of a long document, with the matching words marked and the counsel-only mark where it applies. Words, a quoted phrase, or a word to leave out all work.',
    "A matter paper's file is not searched yet, only its title and what it shows.",
  ],
}

export default note
