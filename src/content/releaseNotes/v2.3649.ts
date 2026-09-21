import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3649',
  date: '2026-09-20',
  title: 'Developers: the agent door can check the database’s health',
  kind: 'infra',
  highlights: [
    'A developer’s coding agent can now ask whether the database froze recently, how full its connections are, who is waiting on a lock right now and who is holding it, and which database changes have been applied — each answer opens with a one-line reading.',
    'It can also check that every server function is able to start, which catches a function that deployed but cannot run.',
    'All of it is read-only and developers-only: it looks, it never restarts or stops anything.',
  ],
}

export default note
