import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2340',
  date: '2026-08-26',
  title: 'Preview the invoice email before it sends',
  kind: 'feature',
  highlights: [
    'A new Preview email button in Bill Customer (physical invoice) opens the exact email your customer will receive — subject, body, and the payment-history card — in a new tab, without sending anything.',
    'It sits next to the existing PDF Preview button; what you see is byte-for-byte what sends.',
  ],
}

export default note
