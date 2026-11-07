import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6621',
  date: '2026-11-07',
  title: "A document on a person's HR file, read a section at a time from the dev seat",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now read a named document, or the summary or narrative, a piece at a time: first its list of sections with their sizes, then one section by its number or heading, with the sections before and after named.",
    'A long document never travels whole. The section read uses the same cuts the seat edits by, so what was read can be changed with one op.',
  ],
}

export default note
