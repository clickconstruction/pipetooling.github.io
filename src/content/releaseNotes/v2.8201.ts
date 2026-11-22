import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8201',
  date: '2026-11-21',
  title: 'A job photo and a report photo keep where they were taken',
  kind: 'feature',
  highlights: [
    'The app keeps where your phone was when you took a job photo or a report photo. Your phone is read once and is not followed.',
    'Open a photo and press Taken here to see that spot in your phone’s maps.',
    'A photo picked from the phone’s library later keeps no spot, since it is not of where you are standing.',
    'Whoever can open the job’s photos can read where one was taken.',
  ],
}

export default note
