import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7001',
  date: '2026-11-12',
  title: 'First look: a customer\'s photos and video are kept in Google Drive',
  kind: 'feature',
  highlights: [
    'What a customer sends through a First look is kept in Google Drive, in a Customer supplied photos folder under the customer. Each look gets a folder of its own, named by its day and place.',
    'A video is copied to Drive in pieces, so a long one never stops the copy. The pictures they text back go to the same folder.',
    'The First look card says Open in Drive once the files are there. For a caller who is not a customer yet, it says they file once the number has a customer.',
    'A customer who adds photos and closes the page without pressing Send is counted as sent after half an hour.',
  ],
}

export default note
