import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6239',
  date: '2026-10-31',
  title: 'When Drive refuses a dev’s plan set, the answer says which share fixes it',
  kind: 'fix',
  highlights: [
    'When the dev seat cannot put a plan set into Drive, its answer now names the reason, the service account, the division folder and the share that fixes it.',
    'A folder the account can see but not write asks for Editor. A folder off a Shared Drive asks for the move. A rate limit asks for a minute.',
    'Every answer still says how to drop the file in by hand, and that the same plan can be applied again once the share is made.',
  ],
  roles: ['dev'],
}

export default note
