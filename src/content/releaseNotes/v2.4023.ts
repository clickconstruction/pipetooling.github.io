import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4023',
  date: '2026-09-28',
  title: 'My Time day editor: Save keeps each part on its own job',
  kind: 'fix',
  highlights: [
    'Splitting one session and merging two others in the same block could save hours onto the wrong job: the parts were written onto the sessions in order, so a job could lose time or take time that was another job’s, and the job you chose when merging was dropped.',
    'That kind of edit now saves each part with its own job, including the one you chose when merging.',
    'For a block that mixes punched and salaried time, Save now refuses that kind of edit instead of writing it wrong; sliding the line between two sessions still saves as before.',
  ],
}

export default note
