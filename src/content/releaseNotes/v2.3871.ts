import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3871',
  date: '2026-09-26',
  title: 'Edit Job: the labor figures come from the same math the Job window uses',
  kind: 'fix',
  highlights: [
    'Edit Job’s cost block and its delete check read the job’s team labor and its sub-labor sheets through a loader written inside the form, with its own copy of the drive-cost formula. That loader is now a small hook that rides the same read and the same cost kernel the Job window’s profit band uses, so the two can never disagree.',
    'Nothing on screen changes; the figures are the ones the form showed before.',
  ],
}

export default note
