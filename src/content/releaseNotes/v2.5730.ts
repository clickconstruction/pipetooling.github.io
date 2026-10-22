import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5730',
  date: '2026-10-22',
  title: 'Robots: the heartbeat says where the robot is, in words',
  kind: 'feature',
  highlights: [
    'A robot now tells the app where it is every five minutes while it works: the step it is on, what it has read, what it has written, what it waits on and what comes next. The Console’s Recent runs shows those words. The bid’s own progress bar comes in the next update.',
    'A round that finds nothing to do says so once, and a day of quiet rounds is one line in the ledger, not hundreds.',
    'Every call a robot makes stamps its key, so the app can tell a robot is alive even when it forgets to check in. The key also carries the Stop the rounds switch the Console will press from the next update.',
  ],
}

export default note
