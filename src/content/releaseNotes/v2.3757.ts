import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3757',
  date: '2026-09-23',
  title: 'View bill has a QR code: scan to pay, with our mark in the middle',
  kind: 'feature',
  highlights: [
    'The Payment Links row in View bill (Jobs → Pipeline → Billed) has a fourth door after Copy · Text · Email: a QR code. It opens the code large enough to scan off a screen — a customer at the counter, a phone held up in the field — with the bill, the job and what is still owed under it.',
    'Copy image puts the code on the clipboard for a text or an email body; Download PNG saves it for a flyer or a Google Doc; Print gives a half-sheet to leave with the bill. The job window’s Bills tab has the same door as the word QR beside Text · Copy link · Email.',
    'The code carries the bill’s own address (clicktooling.com/pay/…), not Stripe’s link, so a printout stays good after Stripe’s link rolls over — it fetches the current one when scanned. The hand-and-wrench sits in the middle, carved out of the code rather than pasted over it.',
    'A bill with no Stripe invoice has no code, the same as it has no links today.',
  ],
}

export default note
