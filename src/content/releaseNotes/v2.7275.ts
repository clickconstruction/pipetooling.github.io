import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7275',
  date: '2026-11-14',
  title: 'GC difficulty rating, part 1: the criteria a GC is rated on, versioned',
  kind: 'feature',
  highlights: [
    'Settings → Difficulty criteria, for a dev: the scales a GC will be rated on, each with its rungs and the sentence a person picks for each. Version 1 holds today’s three: Paying, read from the GC’s bills; Field and superintendent, 0 to 3; Their office, 0 to 2.',
    'A published version never changes. The dev edits a draft, previews the GC’s card from it and publishes the next version after a window that lists every change. A rating and a priced bid will pin to the version they were made under, so new words never move old points.',
    'Nothing prices anything yet. The rating on the GC’s record, the office’s price list on the Bid Board and the cost lines on the estimate come in the next parts.',
  ],
}

export default note
