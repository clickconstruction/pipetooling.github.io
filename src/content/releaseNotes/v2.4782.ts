import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4782',
  date: '2026-10-07',
  title: 'Uncollectible: the ledger learns a bill the office has given up on (step 1 of 6)',
  kind: 'feature',
  highlights: [
    'A Collections job can now carry an Uncollectible mark with a required reason, who gave up and when. Nothing shows on a screen yet; the Pipeline band and the stamp come in the next steps.',
    'The mark clears itself when the job pays in full or is sent back to Billed, and the job\'s activity thread records every move with the reason.',
  ],
}

export default note
