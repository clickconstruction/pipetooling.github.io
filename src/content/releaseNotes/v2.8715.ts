import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8715',
  date: '2026-11-27',
  title: 'The proof: download the packet with the signed copies',
  kind: 'feature',
  highlights: [
    'The packet’s window on a development’s page has a Download button. It makes one PDF: the list, then each signed copy.',
    'The button names how many signed copies it goes for. With nobody signed yet it downloads the list.',
    'A copy that cannot be attached is left out and named with its reason, under the buttons and on the list. The others are still attached.',
  ],
}

export default note
