import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2433',
  date: '2026-08-28',
  title: 'Digital twins console: the page tells the story',
  kind: 'feature',
  highlights: [
    'A four-step pipeline strip (mint a twin → issue its key → connect a harness → watch the runs) numbers every card, so the console explains itself on first open.',
    'Each twin now shows its full three-rung safety ladder — current rung lit, with Graduate ↑ / Back ↓ right on the next rung — instead of a bare status chip.',
    'Tokens are key pills with last-used liveness ("used 2h ago") and one-click revoke; the run ledger reads in plain English with SIGN-IN / REPORT chips and relative times.',
  ],
}

export default note
