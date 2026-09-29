import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4100',
  date: '2026-09-28',
  title: 'The GC statement email says what paid each bill',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under each bill on the weekly statement email — sent from the app, scheduled, or pasted with Copy — a small line now says what paid it and when, and what is still open: "$12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open", or "nothing applied yet". The same words the printed statement, GC Review and the portal already show.',
    'When what is left on a bill is the retainage the job records, the line says so: "… still open, the retainage you hold".',
    'The plain-text copy carries the line after the amount, so a text-only mail client reads it too.',
  ],
}

export default note
