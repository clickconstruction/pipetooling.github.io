import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4047',
  date: '2026-09-28',
  title: 'Write up a change lives on the job, not in the Dashboard header',
  kind: 'feature',
  highlights: [
    'The purple Estimate/Change Order button under the clock row is gone. Each job in My Schedule now carries a paper-and-pencil square beside Leave Report; tap it and the write-up opens already on that job, skipping "Which job is it on?".',
    'A small link under the list — "Write up a change on another job, or new work" — still opens the wizard the old way for a job that is not on your day, or an estimate for someone new.',
    'Same opt-in as before (Settings → Dashboard & alerts), now called "Write up a change from the field".',
  ],
}

export default note
