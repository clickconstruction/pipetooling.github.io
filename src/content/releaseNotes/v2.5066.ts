import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5066',
  date: '2026-10-09',
  title: 'GC mode: move a bar on the schedule, and say why',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev can drag a bar on a GC project’s schedule, pull one of its ends, or link two bars. Each move asks why before it saves.',
    'Changes to the schedule lists every move with who made it and why. The newest can be undone, and put back.',
    'When someone else saved first, the save stops and says what they changed. Your words stay, and one press saves the move on the new dates.',
  ],
}

export default note
