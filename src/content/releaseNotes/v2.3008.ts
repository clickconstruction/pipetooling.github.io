import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3008',
  date: '2026-09-07',
  title: 'The primary address is a property now',
  kind: 'feature',
  highlights: [
    'Edit customer → Addresses lists every property in one place, the primary first with a ★. Click ☆ on any other address to make it the primary; the customer\'s header address follows.',
    'The customer\'s own property can now carry the legal record (county, legal description, owner of record) and be linked to a job for lien paperwork — before, only "additional" addresses could.',
    'Nothing else moves: the New Customer page, merges, map links and pickers keep working exactly as before.',
  ],
}

export default note
