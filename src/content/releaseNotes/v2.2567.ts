import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2567',
  date: '2026-09-01',
  title: 'Resend buttons now say Stripe sends the email',
  kind: 'fix',
  highlights: [
    'Every yellow invoice-resend button — Payment follow-up, the Stages board, Bill Customer — now carries a small purple stripe tag, so it\'s clear the email comes from Stripe, not the app.',
    'The full-size button reads "Send Email invoice" with the tag carrying the "from Stripe" part.',
    'The confirm dialog now leads with a badged "Sent by Stripe to …" row and spells out that resending is the same invoice and payment link — no new bill, no charge.',
  ],
}

export default note
