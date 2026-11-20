import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7975',
  date: '2026-11-19',
  title: 'Trips: the join window says a line keeps its name',
  kind: 'fix',
  highlights: [
    'A trip on a bill has one line on its job. Joining two trips never changes that line’s name.',
    'The join window now says so. The name may still show the old trip’s number and days.',
    'Change the name on the job’s Bill tab if the bill should show the joined trip.',
  ],
}

export default note
