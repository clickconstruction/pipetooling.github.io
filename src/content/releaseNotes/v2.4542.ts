import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4542',
  date: '2026-10-05',
  title: 'Submittals: a rows table that fits the bid',
  kind: 'feature',
  highlights: [
    'On a bid built from the takeoff, the rows table drops the columns that were always empty. It reads Fixture, Product and parts, Their answer and Cut sheet. A bid with a schedule keeps Specified and reads status, reason and lead time in one cell.',
    'Each part is its own line with the GC\'s answer beside it, so "Rejected" sits next to the part it is about, with their note.',
    'Small buttons over the table count what is left, like "Need a cut sheet 6". Press one to see only those rows.',
    'On a phone each fixture is a card and nothing scrolls sideways. On a draft row, Part of… and the × are now behind a ⋯ button.',
  ],
}

export default note
