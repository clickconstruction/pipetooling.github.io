import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3069',
  date: '2026-09-07',
  title: 'Opening a job from a bid marks the bid Started or complete',
  kind: 'feature',
  highlights: [
    'A job linked to a bid now moves that bid to Started or complete on its own — from the Job form, Open the job, a signed estimate, or an import — and bids that already have a job are caught up.',
    'When it happens as you save, a toast names the bid and what it was, and stays on screen for five seconds.',
  ],
}

export default note
