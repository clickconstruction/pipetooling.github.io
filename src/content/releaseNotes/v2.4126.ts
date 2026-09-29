import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4126',
  date: '2026-09-29',
  title: 'Submittals: four words over the eight steps',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The strip’s eight pills now sit under four words: Build (steps 1 to 3), Send (4 and 5), Their answer (6 and 7), Order (8). Four parts are easier to hold than eight steps.',
    'Each word takes its color from its steps: blue while you are in it, amber while it waits on the reviewer, green once every step in it is done.',
  ],
}

export default note
