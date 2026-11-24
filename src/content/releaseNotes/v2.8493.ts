import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8493',
  date: '2026-11-24',
  title: 'Bills sent: a day names the bank deposits that are on no bill yet',
  kind: 'feature',
  highlights: [
    'In By day paid, a picked day now has one quiet line when bank deposits landed that day and are on no bill yet. It reads like “2 deposits landed that are on no bill yet”, with what they add up to.',
    'Those deposits are not added to the day, the month, a tile, the print or the CSV. The line says “Not added to the day”.',
    'Open deposits on the line goes to Accounts Receivable, where a deposit is put on a bill.',
    'The count is worked out by the same rule as the Dashboard’s Money in bar, so a day that differs between the two now says why.',
  ],
}

export default note
