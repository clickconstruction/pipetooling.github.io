import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3276',
  date: '2026-09-11',
  title: 'Bids → Labor: a New view that puts the unanswered rows first',
  kind: 'feature',
  highlights: [
    'Bids → Labor now has Old · New pills beside Print. Old is today’s HOURS grid, unchanged and still the default. New shows whether the estimate is usable as a job budget, the hours as crew-days and dollars, and revenue per field hour against the bid value.',
    'In New, rows the labor book could not answer sit in a queue at the top. Each one shows the book’s best guess (by name, alias or plan code like LAV2 → Lavatory); pick what the row means, set the hours, and Save & learn — the book remembers the alias for every future bid. Fill N from the book takes every matched row at once and never touches hours you typed.',
    'Every filled row says where its hours came from: book, edited, or typed. Your choice of Old or New is remembered on this device.',
  ],
}

export default note
