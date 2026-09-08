import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3155',
  date: '2026-09-08',
  title: 'Hand robot shadow coverage to another person in one copy',
  kind: 'feature',
  highlights: [
    'Settings → Digital twins has a “Hand shadow coverage to someone” card with a Copy handoff prompt button. The prompt walks a new operator through issuing their own robot key, the one permission rule, and the hourly routine, with the routine’s instructions inside it word for word.',
    'Keys are issued per person and revoked on the same page, so handing coverage over never means sharing a key.',
  ],
}

export default note
