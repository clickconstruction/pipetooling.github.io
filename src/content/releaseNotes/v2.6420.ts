import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6420',
  date: '2026-11-02',
  title: 'Editing a job’s Specific Work keeps every stage’s checklist, window and progress',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A stage line keeps its id when the job form saves. Before, every save of the money section rewrote the lines as new ones, and a stage’s checklist answers, the checks added for the job, its skipped questions and its window went with the old line.',
    'A stage’s crew-reported progress and the day a line was made stay as they were through a save.',
    'A report photo or a job photo that names a stage keeps naming it.',
    'The job’s Activity no longer says Specific work added for every line on every save. A line is added once.',
  ],
}

export default note
