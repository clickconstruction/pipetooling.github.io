import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3843',
  date: '2026-09-25',
  title: 'Supply houses: a payment’s receipt link sits beside the invoice',
  kind: 'feature',
  highlights: [
    'Make Payment’s “Payment or receipt link” used to replace the link on every bill you ticked — so the scan of the invoice was swapped for the receipt.',
    'The receipt now has its own place: each bill’s row shows View for the invoice and Receipt for the payment. Paying never touches the invoice link, and a blank box changes nothing.',
    'New guide: mark supply-house bills paid.',
  ],
}

export default note
