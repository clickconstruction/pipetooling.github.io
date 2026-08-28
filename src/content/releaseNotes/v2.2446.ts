import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2446',
  date: '2026-08-28',
  title: 'Billing a job stage by stage works all the way to the last stage',
  kind: 'fix',
  highlights: [
    'Splitting a Ready-to-Bill job into per-stage invoices used to fall apart on the last one: the final "Create invoice from remaining on selected segments" showed "Nothing left to bill; invoice amount would be zero" — even though the invoice was actually created — and left a $0.00 draft in the list. Now it just works: the invoice is created, the auto remainder draft removes itself, and you get the normal confirmation.',
    'The Paid + Billed + New Invoice chips and the Make Invoice amount box no longer count the auto remainder draft as already billed. Ready-to-Bill jobs used to read "100% Billed / 0% Left to bill" and change any amount you typed to $0 — they now show what is truly left, and typing the full remainder still opens Bill Customer like before.',
    'If the remainder re-sync ever does fail after an invoice is created, the message now says the invoice was created and what did not sync — instead of looking like the whole thing failed.',
  ],
}

export default note
