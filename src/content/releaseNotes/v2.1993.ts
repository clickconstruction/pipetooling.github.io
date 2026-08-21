import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1993',
  date: '2026-08-21',
  title: 'Customer profile v2 — money-first jobs, GC context, recent activity',
  kind: 'feature',
  highlights: [
    'The customer profile\'s jobs are now a money-first list: each row shows what\'s billed, how old (red at 90+), and the open dollars — and the rows always add up to the open balance. Click a job to open Job Detail on top.',
    'GCs get a "GC on N jobs" chip and "statement last sent" right in the header, and a Recent activity section shows the latest notes across their newest jobs.',
    'Works cleanly on phones, and a Public page button is reserved in the footer for the coming customer-facing page.',
  ],
}

export default note
