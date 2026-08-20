import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1919',
  date: '2026-08-20',
  title: 'Smoother scheduled-email delivery',
  kind: 'fix',
  highlights: [
    'The scheduled report emails (billed report, GC statements, weekly movement, weekly money, paid-job notices) now go out on lightly staggered minutes instead of all at once, so the system stays responsive while they send.',
    'Nothing changes about what you receive — a scheduled send still arrives within a few minutes of its scheduled time.',
  ],
}

export default note
