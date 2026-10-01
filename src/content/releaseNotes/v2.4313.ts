import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4313',
  date: '2026-10-01',
  title: 'Accounts Receivable: a check that came back cannot pay a bill',
  kind: 'fix',
  highlights: [
    'A check the bank sent back, or one marked returned, no longer offers bills to pay. Its pane says it came back, and Apply stays off.',
    'The database refuses it too, from every place a deposit can be put on a bill.',
    'The Pipeline’s Allocate bank deposits count no longer counts a check the bank sent back.',
    'Unlink and remove on a bounced check says the bank sent it back, instead of saying the money is available again.',
  ],
}

export default note
