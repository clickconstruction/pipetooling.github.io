import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6199',
  date: '2026-10-30',
  title: 'The Development page on a phone: the Show chips scroll sideways in one row',
  kind: 'fix',
  highlights: [
    'Under the History composer the seven Show chips, Everything through Questions, used to wrap onto three lines on a phone with Questions alone on the last. They now sit in one row that scrolls sideways, as the Pipeline stage strip does.',
    'When a piece is picked, its chip, like JP1098 only, sits under the strip where it is always in view.',
    'The desk keeps the chips in one wrapping row as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
