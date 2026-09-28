import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3904',
  date: '2026-09-27',
  title: 'People → Review: old loading code removed',
  kind: 'fix',
  highlights: [
    'A way of loading one person’s review that nothing had used since the Team Summary got its own loader came out of the Review tab. Nothing that runs changed.',
  ],
}

export default note
