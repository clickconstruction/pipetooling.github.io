import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2584',
  date: '2026-09-01',
  kind: 'feature',
  title: 'Bank deposits now name their customer',
  highlights: [
    'Accounts Receivable reads who a deposit came from and leads with that customer\'s open bills — "From Done Right Foundation — their open bills" — so you don\'t need to know which jobs are theirs.',
    'It checks the bank counterparty first, then the deposit\'s note and memo (check services often put the real customer there), and understands initials like "DRF".',
    'Bills matching the deposit amount are highlighted green and listed first; one tap fills the allocation.',
    'The bill picker now also finds bills by customer or GC name — typing "weiss" works even when the job name doesn\'t mention them.',
  ],
}

export default note
