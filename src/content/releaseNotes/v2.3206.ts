import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3206',
  date: '2026-09-09',
  title: 'Bid flow: even ticks, and a strip that fits',
  kind: 'fix',
  highlights: [
    'The thin bar under a bid’s jump icons is now ten equal ticks, one per step, with a small gap between phases — every row reads the same.',
    'Open a row and the full strip fits its box again instead of running off the right edge; the last steps were hiding behind a scroll.',
  ],
}

export default note
