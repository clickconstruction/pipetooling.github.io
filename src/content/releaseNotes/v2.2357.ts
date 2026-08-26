import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2357',
  date: '2026-08-26',
  title: 'Page no longer freezes after a bid preview quick link',
  kind: 'fix',
  highlights: [
    'Opening a bid preview from the Bid Board and jumping out through an "Open in Bids" quick link could leave the whole page unable to scroll until a reload. The freeze is fixed.',
    'The same safeguard covers every modal in the app when the browser tab is backgrounded or embedded — the scroll lock now always lets go when the modal closes.',
  ],
}

export default note
