import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6663',
  date: '2026-11-07',
  title: 'Stage jobs: the Pipeline bar shows each stage at the number the crew gave it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'superintendent'],
  highlights: [
    'On a job with stages, once the crew has reported a number for a stage, the amber on each block of the Progress & payment bar is that stage done to its own number. Before, the bar poured the job\'s done-not-billed figure down the stages in order, so a stage the crew said was 30% along could read 38% from the job\'s typed percent.',
    'A done stage that is not yet billed reads all amber; a stage with a bill on it keeps its blue first, and only the rest of its number is amber; a later stage reads grey. The tick, the % done box and the legend still read the job\'s one number.',
    'A stage job whose crew has not reported any stage pours as before. Plain multi-line jobs got the same reading in v2.6653.',
  ],
}

export default note
