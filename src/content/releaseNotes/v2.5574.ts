import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5574',
  date: '2026-10-16',
  title: 'Prospects: New Prospect and Edit prospect fit on the screen',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'New Prospect and Edit prospect no longer run off the top and bottom of the screen. Each window stays inside it and scrolls its own boxes, so Save is always one scroll away.',
    'New Prospect is a little wider, so the three cards at its top (a customer, a job to GC, a sub) read in a few lines each.',
  ],
}

export default note
