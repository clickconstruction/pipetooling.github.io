import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2589',
  date: '2026-09-01',
  title: 'Bills stop re-listing line items already billed elsewhere',
  kind: 'fix',
  highlights: [
    'When a job is parted out across invoices, a bill no longer lists line items that are already on another invoice — a remainder bill after a billed change order now shows only the remaining work.',
    'Reported from the field: a $1,072.50 remainder invoice showed the already-billed change order as a second line. It now reads just the remaining line at the full invoice amount.',
  ],
}

export default note
