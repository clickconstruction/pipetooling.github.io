import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8547',
  date: '2026-11-24',
  title: 'Punch list: the merge queue is on the page',
  kind: 'feature',
  highlights: [
    'In the merge queue sits above the Burndown. It lists each change on its way to the app, with its place, how long it has waited and about how long is left.',
    'Merged today, Merges an hour and a column for each hour show how fast changes are landing.',
    'The list is the one on Settings → How fast a change ships. A dev’s page reads GitHub once more when the last read is over five minutes old.',
    'Hide the queue folds it to one line that still says how many are in line.',
  ],
}

export default note
