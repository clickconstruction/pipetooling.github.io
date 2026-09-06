import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2953',
  date: '2026-09-06',
  title: 'The Bridge loads again',
  kind: 'fix',
  highlights: [
    'The dev-only Bridge page (net position and cash forecast) had stopped loading with "column supply_house_invoice_job_allocations.id does not exist". It paged the supply-house allocations by a column that table never had; it now orders by invoice and job.',
  ],
}

export default note
