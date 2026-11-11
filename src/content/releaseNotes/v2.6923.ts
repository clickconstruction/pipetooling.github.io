import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6923',
  date: '2026-11-10',
  title: 'The pricing twin leaves a quote as a price sheet',
  kind: 'feature',
  highlights: [
    'When the pricing twin reads a bid\'s quotes, it now leaves each one as a price sheet on Takeoffs, row by row as printed.',
    'The sheet shows as a chip that ends with the word twin. Press it to open the sheet.',
    'The twin files nothing and names no part. Every price waits for your press.',
  ],
}

export default note
