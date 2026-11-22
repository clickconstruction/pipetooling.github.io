import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8269',
  date: '2026-11-21',
  title: 'Sub papers: a payment typed late is carried to the next statement of account',
  kind: 'fix',
  highlights: [
    'A payment typed after a statement was made, but dated inside it, was on no statement. The next one opened lower than the last one closed, with no payment to show why.',
    'Since the last statement now carries such a payment. It is listed under its own date and marked as recorded after the last statement.',
    'The statement then opens on the figure the last one closed on. A back-charge or a sheet typed late is carried the same way.',
    'This month, This year, To date and Pick dates are still cut by the date on the payment alone.',
  ],
}

export default note
