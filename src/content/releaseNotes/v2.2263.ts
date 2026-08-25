import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2263',
  date: '2026-08-25',
  title: 'Review tab fits phones again',
  kind: 'fix',
  highlights: [
    'The Goals progress bar wraps into tidy rows on phones instead of running off the screen (it outgrew one line as the roadmap passed 50 stages).',
    'The sign-off section title is now one line: "Review: completed work".',
    'Tasks scheduled today say how fresh they are — "2h ago" — instead of showing a raw date.',
  ],
}

export default note
