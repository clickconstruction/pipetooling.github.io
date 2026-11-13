import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7065',
  date: '2026-11-12',
  title: 'Bids: the pricing email shows its cents in smaller type',
  kind: 'feature',
  highlights: [
    'In Share with a teammate, each amount in the pricing table now shows its cents smaller than its dollars.',
    'The amounts are the same to the cent. Only the size of the cents changed.',
    'The preview in the window and the table copied by Send via my mail show it right away. Send for me follows once its sender is updated.',
  ],
}

export default note
