import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6736',
  date: '2026-11-08',
  title: 'The full typecheck runs one at a time across a machine’s worktrees',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'npm run typecheck now takes a machine-wide lock before it runs. A second typecheck from another worktree waits, saying every 30 seconds who holds the lock and for how long, then runs when the first finishes. Two at once held about 9.5 GB each on 2026-11-08 and the app had to be restarted.',
    'A lock left by a typecheck that was killed is taken over on the next try. CI skips the lock, since each job is its own machine. Nothing on any screen changes.',
  ],
}

export default note
