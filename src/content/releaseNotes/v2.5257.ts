import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5257',
  date: '2026-10-12',
  title: 'Messages: each step’s usual and How it is going, read from what was done',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A step’s usual is the middle of the times it took over the last year. Under five done it has no usual yet.',
    'How it is going reads one row per step: on it now, the usual, the longest now, done this quarter, and where it sticks.',
    'The funnel counts each job from the first ask to the signed paper, with the share that went on and the ones that fell out.',
  ],
}

export default note
