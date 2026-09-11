import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3345',
  date: '2026-09-11',
  title: 'Bills go to: the job says whether the customer or the GC gets its bills',
  kind: 'feature',
  highlights: [
    'Edit Job has a new "Bills go to" row once a job has a GC: This customer, the GC, or Split by line. Set it once and Bill Customer, Stripe, and the PDF address that party — no more typing the GC\'s address into the customer\'s email.',
    'Each GC keeps its own billing email (the AP inbox), separate from the estimating contact — on the GC/Builder rows in Edit Job and on Edit customer.',
    'On the Bill tab, "Bill to ▾" on a draft picks who that one bill goes to — the customer, the GC, or someone else (the tenant case). A chip on the row names the payer.',
    'Bill Customer says who is being billed and why, offers that party\'s contacts, and lets you copy the other party with one tick.',
  ],
}

export default note
