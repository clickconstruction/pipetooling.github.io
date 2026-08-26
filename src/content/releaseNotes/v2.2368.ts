import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2368',
  date: '2026-08-26',
  title: 'Decimal prices work in the Pricing Workbench',
  kind: 'fix',
  highlights: [
    'Typing a price with cents in the Workbench sale-price column now works — the field used to eat the decimal point as you typed, so 500.25 landed as 50025.',
    'The field keeps exactly what you type while you type it; leaving the field (or pressing Enter) tidies the price to cents.',
    'Clearing the field now returns the row to its saved price instead of forcing it to $0.',
  ],
}

export default note
