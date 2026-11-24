import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8526',
  date: '2026-11-24',
  title: 'Bills sent: on a phone, the deposits line keeps its total beside the sentence',
  kind: 'fix',
  highlights: [
    'In By day paid on a phone, the line for bank deposits that are on no bill yet put its total on a row of its own under the sentence.',
    'The sentence now wraps and the total stays beside it, the way a payment’s amount sits beside its name. At a desk the line looks as it did.',
  ],
}

export default note
