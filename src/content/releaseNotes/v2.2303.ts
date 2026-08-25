import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2303',
  date: '2026-08-25',
  title: 'Payments know when they were sent',
  kind: 'feature',
  highlights: [
    'Every payment on the Bill tab now has an optional Sent date ahead of Received — the date on the check. Bank-linked payments offer their posting date as a one-tap fill.',
    'A received date in the future gets a quiet warning — probably a flipped month and day.',
    '"Open job" from the Pay speeds drill-down and receipts now lands straight on the Bill tab.',
    'Devs get a ⚙ No Count Date in the Data health screen — payments received before it stop counting anywhere.',
  ],
}

export default note
