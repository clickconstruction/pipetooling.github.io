import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6722',
  date: '2026-11-08',
  title: 'The dev seat reads a matter’s text document a section at a time',
  kind: 'feature',
  highlights: [
    'get_matter_document reads a .md or .txt on a matter’s Evidence tab the way get_person_document reads a named document on an HR file: the section index first, then one section by its number or heading, so a long document never crosses the door whole.',
    'A search_case hit on a matter’s text document names its section, and read_next says how to read that section on.',
    'A PDF, an image or an .eml is refused with what it is. A counsel-only paper is refused to the seat as deployed; a dev signed in reads it on the desk.',
    'Under the hood the HR file’s document reads and the matter’s share one section grammar, and the seat’s own reads name the documents table.',
  ],
}

export default note
