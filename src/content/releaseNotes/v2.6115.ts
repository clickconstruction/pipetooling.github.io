import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6115',
  date: '2026-10-29',
  title: 'Job window → Costs: every cost row on the job, and a window that moves ticked rows to another job (devs)',
  kind: 'feature',
  highlights: [
    'On the job window’s Costs tab, devs now see every cost row on the job in one list by stream: bank allocations with the card, the category and the note, supply-house invoices with their share, clock sessions by person with hours and standing, and Other job charges, with totals per stream. A click anywhere on a row ticks it; a press ticks a whole stream, a person’s sessions, a card’s rows or a date range.',
    'Move N rows… opens a window on the ticked rows: pick the job they go to, write the reason and the plan’s name, and the window builds the batch — each bank row released from this job and allocated to the other, each invoice and session repointed, one note on each job. A rejected session stays; an Other charge is listed but cannot be moved by a batch, and the list says so.',
    'Dry run calls the database with the real code path and lays its totals by job beside the plan’s own, to the cent. Apply is live only after a matching dry run of this exact plan and your word that you read it; it runs the dry run once more and writes only when it still matches, then the job’s rows and its batches are read again.',
    'Under the list, the batches that touched this job, each with its label, reason, plan, time, author, op count and summary by job, its ops on demand, and Revert behind the typed word and a reason. Banking has a dev-only Cost batches tab with every batch company-wide and the same Revert.',
  ],
  roles: ['dev'],
}

export default note
