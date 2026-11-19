import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7850',
  date: '2026-11-18',
  title: 'Stages: one rule for the stage a line’s name reads as',
  kind: 'fix',
  highlights: [
    'A job line’s stage is now read the same way everywhere: on the Pipeline, on a stage checklist, on a pay application and on Bid vs actual.',
    'A line named Set trim reads as the Trim stage. A line that names two stages, such as Rough in, top out and trim, reads as none, since it is the whole job.',
    'Bid vs actual no longer takes a service line such as “installed shower trim” for the Trim stage, and it now counts a Final line with Trim.',
  ],
}

export default note
