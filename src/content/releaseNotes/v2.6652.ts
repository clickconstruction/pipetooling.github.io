import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6652',
  date: '2026-11-07',
  title: 'The walk kit runs on a nightly schedule, from any checkout',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Messages walk runs every night at 09:00 UTC from GitHub Actions and on demand, with its report attached to the run, so a leg of the loop that stops landing on prod is seen the next morning instead of at the next live test.',
    'The dev sign-in door admits the walk tester again. The door was closed to everyone but a dev or a digital twin earlier today, which left the kit unable to press its own sends.',
    'npm run walk starts from a worktree and from a checkout with no env files: the keys come from the main checkout’s files, then the environment, and the driver no longer stops before its first step.',
    'A lost signal on the walk’s first call is tried again instead of ending the run, a call that fails mid-walk ends the run with its reason on the report and still cleans up, and a report with no step that went no longer reads green.',
  ],
}

export default note
