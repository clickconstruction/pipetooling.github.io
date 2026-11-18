import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7859',
  date: '2026-11-18',
  title: 'Dashboard: a Paint a map press that is always there',
  kind: 'feature',
  highlights: [
    'The Dashboard now has a Paint a map press near the top, whether or not you are clocked in or have a job today.',
    'In Job Mode it sits beside the tally button and says which job the map is for. Elsewhere it is a square after Job Report, or a link on the office phone.',
    'The app sets the job when it knows it: the job you are clocked onto, or else the stop you are at or the next one today.',
    'The sheet offers Change the job when the app picked for you. With no job known it opens as before, with Pick the job it is for.',
  ],
}

export default note
