import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5666',
  date: '2026-10-20',
  title: 'Reports: the one-stage picker retires',
  kind: 'infra',
  highlights: [
    'The stage picker that asked which one stage you worked on today is gone. The lines list that replaced it asks about every line at once and opens on far more jobs.',
    'Nothing changes on screen. The arithmetic behind the job’s percent is the same, and the report’s Stage progress field keeps its name.',
  ],
}

export default note
