import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6719',
  date: '2026-11-08',
  title: 'The case search finds a line inside a file on the record',
  kind: 'feature',
  highlights: [
    'The dev seat’s search across a person’s case now reads the files too: a transcript linked from Drive on an evidence record, an email file or a text PDF staged on the record, a document on the matter’s Evidence tab. A line from a call is found by its words without the transcript being retyped.',
    'A file hit names the file and the record it hangs on, with the day and the matching line marked. Narrow the search to files alone with in: files.',
    'A counsel-only record’s file is marked as such on the hit, never hidden from a dev, the same as the record itself.',
  ],
}

export default note
