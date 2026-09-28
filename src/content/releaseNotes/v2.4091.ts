import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4091',
  date: '2026-09-28',
  title: 'Where the checks went: the sheet prints on three pages, not seven',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The first page no longer stops after the heading: rows stay whole across a page break instead of whole tables being pushed to the next page.',
    'The job column gets a third of the width, a column with nothing in it is not drawn, and a check that paid several invoices on one job names the job once with its invoices under it.',
    '"Paid by" reads as dates — "check May 19 · check Jun 4", or "4 payments, Oct 10 – Mar 10" — and the job table is Open, then Paid in full, each with its own total.',
    'A job name that repeats the street reads as the number alone; money not tied to an invoice says so in plain words.',
  ],
}

export default note
