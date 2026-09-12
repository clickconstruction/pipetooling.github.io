import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3358',
  date: '2026-09-12',
  title: 'Bills also go to — a second person on the bill, remembered',
  kind: 'feature',
  highlights: [
    'Edit Job has a "Bills also go to" row under Bills go to. Tick the people at the customer who should get a copy of every bill — an AP clerk, a spouse — or add one right there with a name and email. It is saved on the customer, so their next job already has them.',
    'On a job with a GC, one tick copies the party who is not being billed: the GC on a customer-pays job, the customer on a GC-pays job.',
    'Bill Customer starts with those people ticked in Send to; untick one there to skip them on a single bill. Edit customer → Contacts shows the same flag as a "gets every bill" chip.',
    'For now the copies ride the emailed PDF invoice; Stripe bills still reach one address — copies on Stripe bills are the next release.',
  ],
}

export default note
