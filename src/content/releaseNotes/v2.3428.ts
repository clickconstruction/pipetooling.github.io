import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3428',
  date: '2026-09-14',
  title: 'Job Summary: the Days view counts what changed since a week ago',
  kind: 'feature',
  highlights: [
    'Under the Days tiles, a strip now says how many jobs opened, were billed, were paid, and how many open then are still open — the same strip Timeline shows when you rewind it.',
    'Week chips (1 wk, 2 wk, up to 8 wk when the window is long enough) pick how far back to count; it opens on 1 wk.',
  ],
}

export default note
