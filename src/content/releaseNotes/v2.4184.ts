import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4184',
  date: '2026-09-29',
  title: 'The Contract window\'s highlighted buttons carry their whole border',
  kind: 'fix',
  highlights: [
    'On a sent agreement, a button that switches between plain and highlighted in place (Edit & re-send arming, File the signed copy) redraws its border cleanly instead of tripping a styling warning under the hood. Nothing looks or behaves differently.',
  ],
}

export default note
