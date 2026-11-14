import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7251',
  date: '2026-11-14',
  title: 'Two receipt tests no longer fail just after midnight',
  kind: 'fix',
  highlights: [
    'Nothing in the app changed. Two of the checks that run before a change ships failed every night in the hour after midnight, and held up changes that had nothing to do with them.',
    'Each check made a text sent an hour earlier. Just after midnight that text was from the day before, so the receipt chip rightly named the weekday, and the check did not expect it. The checks now accept the weekday.',
  ],
}

export default note
