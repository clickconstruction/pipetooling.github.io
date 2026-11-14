import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7267',
  date: '2026-11-14',
  title: 'Materials on site: a delivery refused part way is safe to send again',
  kind: 'fix',
  highlights: [
    'In a job’s Deliveries panel, when one line of an invoice cannot be saved, the lines after it still land. Before, a refused line stopped the rest.',
    'The refused line stays on the table with its reason under it, and the panel says how many lines landed. The lines that landed leave the table.',
    'Pressing Add again sends only the lines still on the table, each as the same row it was the first time, so a line that landed is never added twice. Before, a second press added the first lines again.',
    'The rows this press landed are not counted as the invoice landing before, so the second press is not asked about.',
  ],
}

export default note
