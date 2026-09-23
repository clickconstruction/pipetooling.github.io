import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3758',
  date: '2026-09-23',
  title: 'Lien notices carry a page of pay codes — one QR code per unpaid bill',
  kind: 'feature',
  highlights: [
    'The packet the office used to build by hand had a page the app never printed: after the notice, one QR code per unpaid bill under “Once these bills are paid, there will be no lien filed.” The Lien desk run, the emailed copies and the Lien window’s notice now carry it, between the notice and the enclosed invoices.',
    'Each row is the bill’s number and date, its line as the invoice reads it, what is still owed, the code and the address in words. The page closes with the count and the total, and who to call.',
    'The owner’s copy repeats the cover letter’s rule in a box — pay us directly only with the GC’s written okay — so the page never contradicts the letter it follows. The GC’s copy carries no pay page, as counsel described that envelope; that is the owner’s call to change.',
    'The codes carry the bill’s own address, not Stripe’s expiring link, so a letter that sits in a drawer still pays months later; a bill paid since says Paid. A paper-only bill prints its row with no code. Untick Enclose the invoice and the page leaves with the invoices.',
  ],
}

export default note
