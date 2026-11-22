import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8249',
  date: '2026-11-21',
  title: 'GC mode: a trade’s draw is due 10 days after the customer pays',
  kind: 'fix',
  highlights: [
    'An approved draw is now due 10 days after the customer pays the bill it rode on. It used to be due 10 days after we approved it, paid or not.',
    'Until the customer pays, a draw has no pay-by day and is never late. Its line says what it waits on: our next bill, or the customer’s payment.',
    'Money ahead counts each trade’s draw 10 days after its customer should pay. A week no longer dips because we pay a trade before we are paid.',
    'A retainage release is unchanged. It was already paid 10 days after the customer pays our final bill.',
  ],
}

export default note
