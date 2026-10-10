import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5197',
  date: '2026-10-10',
  title: 'GC mode: answer a trade that says it will be late',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A card on the schedule lists each trade that says it will be late, with its new day and its words.',
    'Take opens Why it moved with the trade’s day, reason and words already filled in.',
    'Push back sends your words to the trade’s portal, and the bar keeps its day.',
    'To verify lets our superintendent check each trade’s look-ahead mark, mark our own crew’s work and record an inspection.',
  ],
}

export default note
