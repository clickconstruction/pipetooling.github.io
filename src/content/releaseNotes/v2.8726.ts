import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8726',
  date: '2026-11-27',
  title: 'The office can lift a Build job’s wait from the job window',
  kind: 'feature',
  highlights: [
    'A job marked as waiting on the Bridge’s Build desk now shows a Waits row on its Edit tab, under the status.',
    'The row says since when, why and who marked it. A line typed with the reason shows under it.',
    'The office presses Lift the wait on that row. The job counts on the Build desk again, and its Activity gets a line.',
    'Until now only the Bridge had that press, and the office does not open the Bridge.',
  ],
}

export default note
