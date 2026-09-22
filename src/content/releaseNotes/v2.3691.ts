import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3691',
  date: '2026-09-21',
  title: 'Balances: the doors on residue, overpaid and off-report charges',
  kind: 'feature',
  highlights: [
    'A week that is short of net by under $5 now has Mark settled: one Less line of that amount closes it, the report’s net matches what was paid, and the cents leave the balance. Remove the line from the report to reopen the week.',
    'A week paid past its net has Move extra: the newest payment is trimmed by the extra and the same amount is recorded on the oldest open week under the same date and memo. With nothing open, it files the extra as a credit instead.',
    'A back-charge or damage charge off any report has Take out of a week…: pick an open week and the report’s Less window opens with the charge ready to apply. When someone’s charges cover their open weeks, the settle-up line offers the same door for all of them.',
  ],
}

export default note
