import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6311',
  date: '2026-11-01',
  title: 'Photos: every thumbnail loads, a few at a time',
  kind: 'fix',
  highlights: [
    'Documents → Photos asked Drive for every thumbnail at once, and a fifth of the tiles stayed grey when the burst was refused. Thumbnails now load a few at a time, a refusal is waited out and asked again, and a tile asks only once it is near the screen.',
    'A picture the app has already read is kept, so scrolling back, opening the viewer or a second tile for the same file never asks Drive twice. The job window’s photo strip gets the same.',
  ],
}

export default note
