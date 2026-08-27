import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2395',
  date: '2026-08-27',
  title: 'New bid versions copy ALL the prices',
  kind: 'fix',
  highlights: [
    'Creating a new version (or adding a GC packet) now brings over every price option from the version it starts from — names, offers, and order intact, with the ★ landing on the copy of the source\'s ★.',
    'Before, only the ★ price came along — and a version whose source had no ★ silently started with no prices at all (the "alternate has no prices in it" surprise).',
  ],
}

export default note
