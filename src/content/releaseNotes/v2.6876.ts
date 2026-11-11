import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6876',
  date: '2026-11-10',
  title: 'An estimate’s customer preview: Back no longer lands on a blank page',
  kind: 'fix',
  highlights: [
    'Going back to an estimate’s customer preview after the page had reloaded showed a blank page. It now draws the preview.',
    'The other pages that open without the main app around them were checked for the same fault. The customer portal, the pay link, the sub portal and the rest cannot blank this way.',
  ],
}

export default note
