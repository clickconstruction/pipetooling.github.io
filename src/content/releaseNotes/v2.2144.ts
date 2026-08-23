import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2144',
  date: '2026-08-22',
  title: 'GC Review: the page behind it stays put',
  kind: 'fix',
  highlights: [
    'With GC Review open, scrolling no longer moves the Pipeline board underneath — the review scrolls inside its own panel, and the page is exactly where you left it when you close it.',
  ],
}

export default note
