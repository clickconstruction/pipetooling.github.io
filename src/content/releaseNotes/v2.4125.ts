import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4125',
  date: '2026-09-29',
  title: 'Submittals: every step says what it is for, and its ? walks you through it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'One plain sentence sits under every step’s title, folded or open: “Each row needs a status, a reason if it differs from the plans, and a cut sheet.” A later step no longer says only “appears once Rev 1 has rows”.',
    'A ? beside that sentence starts Walk me through it at that step, so someone stuck at step 5 does not sit through steps 1 to 4.',
    'Step 3’s line says what is still to do: “22 rows. 3 still need a reason. 8 still need a cut sheet.” The full count is on hover.',
  ],
}

export default note
