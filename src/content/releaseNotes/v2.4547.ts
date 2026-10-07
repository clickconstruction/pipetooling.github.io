import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4547',
  date: '2026-10-05',
  title: 'AIA G702-G703: choose how the rows start',
  kind: 'feature',
  highlights: [
    'On a job’s first pay application you choose where the rows come from: one row, a row per Line Item on the job, or the bid’s schedule.',
    'One row is picked for you. Press another option and the rows and the paper change. The window asks first if you already typed in a row.',
    'A Line Item with no price turns its option off and says why. The choice closes after the first Save.',
  ],
}

export default note
