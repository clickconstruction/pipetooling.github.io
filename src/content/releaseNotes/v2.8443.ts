import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8443',
  date: '2026-11-24',
  title: 'Bills sent: a credit’s mark is whole on a phone',
  kind: 'fix',
  highlights: [
    'On By day paid, a day that holds a credit in kind and no money reads credit on a phone. Before, the narrow day cut the mark to 1 credi.',
    'At a desk the day still reads 1 credit. Press the day to see the credit and its count.',
  ],
}

export default note
