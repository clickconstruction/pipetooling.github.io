import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4186',
  date: '2026-09-29',
  title: 'Contracts: a second signer',
  kind: 'feature',
  highlights: [
    'On the agreement, under the customer’s signature frame, press + a second signer and type their name (and email, if you have it). Both spouses sign a homestead’s improvement contract; now the paper has a frame for each.',
    'The customer’s page shows a frame per signer and asks who is signing when both are open; either may sign first. The agreement reads signed — and the signed copy goes out — only when both frames are filled; until then the chip says 1 of 2 signed and the window says who it is waiting on.',
    'When the second signer’s email is on file, they get the link the moment the first signature lands. The signed PDF prints both frames.',
  ],
}

export default note
