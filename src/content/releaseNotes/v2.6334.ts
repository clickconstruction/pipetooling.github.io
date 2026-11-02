import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6334',
  date: '2026-11-01',
  title: 'In the folders: a file the app put there says From the app',
  kind: 'fix',
  highlights: [
    'On a job’s Documents tab, a file the app itself put in one of the job’s folders, like one from Add a file, now wears the blue From the app chip instead of Added in Drive.',
    'Its row no longer shows the app’s Drive account address where a person’s name goes. It reads the day and the size alone.',
  ],
}

export default note
