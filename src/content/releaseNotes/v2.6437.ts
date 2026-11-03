import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6437',
  date: '2026-11-03',
  title: 'A dev’s agent adjusts clock sessions: the start and the end, the description, the job, the approval',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The dev seat gains a plan and apply pair for clock sessions. An agent plans a change to one or more sessions, reads each session before and after, and applies it only when the plan still matches.',
    'Four ops, each on its own: set the start and the end, set the description, move the session to another job, approve it. A refused op names its reason and the ops beside it still land.',
    'The app’s own rules hold inside the door. A start or end the dev moves on a punched session counts as hours the dev typed, for someone else’s second look, and the dev’s own session is never approved by the dev.',
    'A dev may now approve a session and recompute a day’s hours through the same doors the office uses, so a moved start on an approved day reaches the hours grid.',
  ],
}

export default note
