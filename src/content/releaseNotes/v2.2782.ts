import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2782',
  date: '2026-09-04',
  title: 'Sub sheet stages: Activity lines for click-number jobs',
  kind: 'fix',
  highlights: [
    'Moving a sub sheet on a job that has a click number but no HCP number now posts its Sub labor line to the job\'s Activity feed like every other job.',
  ],
}

export default note
