import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7861',
  date: '2026-11-18',
  title: 'Trips: combining two jobs keeps a trip’s job',
  kind: 'fix',
  highlights: [
    'A trip says which jobs its work went on. When two jobs were combined, the trip lost its link to the job that went away, with no warning.',
    'The combine now moves that link to the job that is kept. The trip still says where its work went, and the kept job’s window still lists it under Trips on this job.',
  ],
}

export default note
