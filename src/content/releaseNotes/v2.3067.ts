import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3067',
  date: '2026-09-07',
  title: 'Sub portal: your statement is one tap away, and the office sees the real address',
  kind: 'fix',
  highlights: [
    'Subs and helpers with a login get a "My statement ↗" door on the Job Mode card that opens their own work and pay portal — no more hunting for the texted link, and no more "This link is missing its key".',
    "The office's portal card (People → 🌐) now shows the live address as text with a Change address… button, so what you read out or print is always what resolves. Copy link copies the live address.",
    'A job address that arrived with the word "Null" in it no longer shows that on the sub\'s phone.',
  ],
}

export default note
