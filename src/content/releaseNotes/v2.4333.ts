import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4333',
  date: '2026-10-01',
  title: 'Bill Customer and Accounts Receivable: the last two returned-check lines',
  kind: 'feature',
  highlights: [
    'Bill Customer says when checks from the payer came back this past year, and suggests a card or a bank transfer. It never stops the bill.',
    'In Accounts Receivable, a check applied in the past week reads clears about Oct 8 until the bank can no longer send it back.',
  ],
}

export default note
