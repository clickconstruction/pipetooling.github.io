import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8135',
  date: '2026-11-20',
  title: 'Document builder: Make this the usual keeps a job’s name out of the usual line under the title',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, Make this the usual on the line under the title no longer puts one job’s name on every job. Your usual takes the line with the name left as a blank, and each job reads it with its own name, once.',
    'The name can sit anywhere in the line. Your usual then shows the blank as [the job’s name], where you can move it.',
    'A line that does not say the job’s name stays that job’s own, and the row says why.',
  ],
}

export default note
