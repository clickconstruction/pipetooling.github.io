import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2189',
  date: '2026-08-23',
  title: 'Quickfill: every section asks its question',
  kind: 'fix',
  highlights: [
    'Every section now opens with a one-line question that says what "up to date" means there — "Has every field request been answered or sent on?", "Who owes us, and who do we lean on first?", "Do we have a reading on every truck this week?" — devs can still override any of them.',
    'Warnings no longer repeats the unallocated-deposits alert (it lives on Jobs Cleanup as the Allocate deposits card). "People Hours (Old)" is retired. A one-line legend under the search box explains the "N open" counts.',
  ],
}

export default note
