import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6299',
  date: '2026-11-02',
  title: 'The job window shows what is in the job’s Drive folders',
  kind: 'feature',
  highlights: [
    'On a job’s Documents tab, a new In the folders section lists what is in Customer Pictures, Plans, Team only › Photos, Team only › Sent by us and the job folder itself: the newest files, when and how big and who, and a door to each.',
    'Each file says where it came from: From the app, with what it was (a report photo, a Tally photo, a file the app linked), or Added in Drive when someone put it there by hand.',
    'The list is read from Drive each time the tab opens, so a file dropped into a folder by hand is simply there the next time you look. An empty folder says what fills it; a folder not made yet says when the app makes it.',
  ],
}

export default note
