import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3387',
  date: '2026-09-14',
  title: 'Contract sweep: see the agreement before it goes, and Send & next',
  kind: 'feature',
  highlights: [
    'The sweep is two panes now. The queue on the left; on the right, the selected job’s agreement exactly as the customer will see it — letterhead, scope, amount, payment line, terms — built from the same facts the send uses. Nothing goes out unseen.',
    'Above the document: who it goes to (editable) and the terms for this sweep. Below it, the footer says what will happen — “Emails kcallison@tfharper.com · then J363” — and Send & next lands you on the next job.',
    'The footer follows the row: a builder’s job leads with File their subcontract (Send ours instead stays), a thin scope or no amount dims Send & next and offers Send anyway, no email asks you to fix it on the job. Already signed? File it and Open the full editor are one click away.',
    'On a phone the list is the screen; tap a job to see its agreement.',
  ],
}

export default note
