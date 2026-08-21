import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1931',
  date: '2026-08-20',
  title: 'The "no bill date" money move now shows you the jobs',
  kind: 'fix',
  highlights: [
    'The Pipeline money move formerly called "bills have no bill date" now says what it really found — billed jobs whose open money is on no bill line — and its button filters the Billed section to exactly those rows instead of dumping you on the full list.',
    'A new "No line" chip on the Billed header (next to 30+/90+) filters to the same rows any time, and each one wears a "No bill line" tag explaining the fix.',
  ],
}

export default note
