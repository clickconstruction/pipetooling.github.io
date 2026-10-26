import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5914',
  date: '2026-10-26',
  title: 'Legal desk: documents and the sub-job check read through the generated types',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Legal desk\'s documents client reads and writes legal_matter_documents through the generated types, with no casts and no second read for a table from before the push.',
    'The packet\'s job read and Ours with the owner use the owner-contract columns as typed, with no fallback read for a column missing before the push.',
  ],
}

export default note
