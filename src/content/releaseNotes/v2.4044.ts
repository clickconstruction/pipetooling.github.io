import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4044',
  date: '2026-09-28',
  title: 'GC Review and the portal: under each bill, what paid it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Every bill in GC Review — the certify checklist, the call sheet, the printed statement — now carries a line under it: what paid it and when, and what is still open. "$12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open." An open bill nothing has touched says "nothing applied yet".',
    'When what is left on a bill is the retainage the job records, the line says so: "… still open, the retainage you hold".',
    'The customer portal says the same under each bill, so a GC can see their check landed without calling.',
  ],
}

export default note
