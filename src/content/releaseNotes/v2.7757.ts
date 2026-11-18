import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7757',
  date: '2026-11-18',
  title: 'Pipeline: the row on a follow-up card is worked out by tested pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rules for the job’s row on a follow-up card live in their own tested file. They say which group the job sits in, and what its lines add up to.',
    'Nothing changes on screen. Each follow-up card shows the same row, the same lines and the same totals.',
    'New tests cover those rules, with made-up jobs and prices.',
  ],
}

export default note
