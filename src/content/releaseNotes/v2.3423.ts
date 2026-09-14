import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3423',
  date: '2026-09-14',
  title: 'Supply houses: job accounts are now a record on the job, per house',
  kind: 'feature',
  highlights: [
    'Materials → Supply houses → open a house: a new Job accounts roster lists every job with an account there (open, requested, not needed) and every job that bought from the house with no account on record — with Mark opened and Not needed right on the row.',
    'Mark opened takes two taps after the call: how it was opened (phone, the packet, at the counter), the house’s reference if they gave one, the rep, a note.',
    'Edit a house: a Job accounts setting (expects one per property · optional · none) — Ferguson, Reece and Moore start as expects — and contacts now carry a role (Price requests, Job accounts, Billing) and a phone, so “ask for Curly” is something the app can dial.',
    'This is the first of five: next the job card shows Ferguson ✓ / none yet at the counter with a one-tap ask to the office, then the PO code says it, then the invoice flag sets itself.',
  ],
}

export default note
