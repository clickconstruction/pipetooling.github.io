import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3724',
  date: '2026-09-22',
  title: 'Supply-house invoices: the PO codes for this job near this date, even when the paper says "Auto Zone"',
  kind: 'feature',
  highlights: [
    'Most supply-house invoices carry the job name the tech said at the counter, not the five-digit code, so the card under PO # could rarely fire. Now, once the invoice is on a job, the form lists the PO codes minted for that job at that house within a week of the invoice date — who made the trip, when, and what they said they needed.',
    'No code in the window? It says so in one line: the trip was made without one, or its code sits on another job.',
    'When the PO # is a code on the ledger but the invoice is on a different job than the code was minted for, an amber line says which job the code belongs to — one of the two is wrong.',
  ],
}

export default note
