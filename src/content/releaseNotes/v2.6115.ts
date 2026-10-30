import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6115',
  date: '2026-10-29',
  title: 'Banking: a Cost batches tab moves a job’s cost rows and reverts a batch (devs)',
  kind: 'feature',
  highlights: [
    'Banking has a dev-only Cost batches tab. Pick a job and every cost row on it is listed by source: bank allocations with the card, the category and the note, supply-house invoices with their share, clock sessions by person with hours and standing, and Other job charges, with totals per source.',
    'Tick rows by hand, by source, by card or by a date range, pick the job they move to, write the reason and the plan’s name, and the screen builds the batch: each bank row released from this job and allocated to the other, each invoice and session repointed, one note on each job. A rejected session stays; an Other charge is listed but cannot be moved by a batch, and the screen says so.',
    'Dry run calls the database with the real code path and lays its totals by job beside the plan’s own, to the cent. Apply is live only after a matching dry run of this exact plan and your word that you read it; it runs the dry run once more and writes only when it still matches, then shows the batch and links to it.',
    'Under it, every batch that touched the job and the newest batches company-wide, each with its label, reason, plan, time, author, op count and summary by job, its ops on demand, and Revert behind the typed word and a reason. The job window’s Costs tab has a Move cost door to the screen for devs.',
  ],
  roles: ['dev'],
}

export default note
