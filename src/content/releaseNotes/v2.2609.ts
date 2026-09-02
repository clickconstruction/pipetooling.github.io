import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2609',
  date: '2026-09-01',
  title: 'Addresses no longer end in "Null"',
  kind: 'fix',
  highlights: [
    'Some imported job addresses carried a literal "Null" where the zip code belonged — it showed up on bill cards, search results, and pickers as "San Antonio, TX Null". Compact address displays now drop that junk the same way they drop a trailing zip.',
  ],
}

export default note
