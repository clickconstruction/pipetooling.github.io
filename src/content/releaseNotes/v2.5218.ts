import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5218',
  date: '2026-10-10',
  title: 'The Bridge reads cash on hand from the bank',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Cash on hand is Mercury’s balance, read when the page opens and again on Read again. The accounts with money are named beside it.',
    'The net-position line and the cash forecast start from that figure, so nobody types a bank balance any more.',
    'When the bank cannot be read, the typed figure stands, with the reason beside the box. A typed figure that drifted from the bank is shown with the gap.',
  ],
}

export default note
