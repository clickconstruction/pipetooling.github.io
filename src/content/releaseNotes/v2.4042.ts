import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4042',
  date: '2026-09-28',
  title: 'Pipeline: the schedule strip keeps next week clear of this week',
  kind: 'fix',
  highlights: [
    'On every Pipeline row, the little two-week strip under the job drew next week’s Monday on top of its Tuesday — the box and the letter both. The two weeks now sit apart with a clean break between them.',
  ],
}

export default note
