import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6714',
  date: '2026-11-08',
  title: 'The file index reads the files on a person’s HR file and a matter’s Evidence tab',
  kind: 'feature',
  highlights: [
    'A file on an evidence record, staged in the app or linked from Drive, and a document on a matter’s Evidence tab now have their words read into the file index, the way a job’s files do. A transcript, a text PDF or an email file no longer needs retyping to be found.',
    'An email file (.eml) is read the way a mail client shows it: who it is from and to, the date, the subject, the words, and the name of each attachment.',
    'The index takes a record’s files within ten minutes of filing, and at once when the dev seat files them. Find a file still answers the jobs drive alone; a record’s words are a dev’s, and a counsel-only record’s stay with the record.',
  ],
}

export default note
