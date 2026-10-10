import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5100',
  date: '2026-10-09',
  title: 'GC mode: only Award changes a trade’s award',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A GC trade’s award could be set or cleared by hand, past the Award press and its vetting check. Now only Award and draft the statement of work in Compare quotes changes it.',
    'Nothing on screen changes.',
  ],
}

export default note
