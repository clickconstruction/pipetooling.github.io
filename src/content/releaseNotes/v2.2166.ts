import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2166',
  date: '2026-08-23',
  title: 'Quickfill Jobs Cleanup reads cleanly on a phone',
  kind: 'fix',
  highlights: [
    'Sub labor rows now wrap their detail line (typed number · date · address) instead of clipping it at phone widths — "no job with this number" and the address are always fully readable.',
  ],
}

export default note
