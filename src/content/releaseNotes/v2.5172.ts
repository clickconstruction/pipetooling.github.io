import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5172',
  date: '2026-10-10',
  title: 'GC mode: a trade partner sends its files from its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner can pick a file with its quote, a change it asks for, or a submittal it owes.',
    'Each file goes into the job’s folder in Drive, and the quote, change or submittal shows its link.',
    'It sends a PDF or a photo of 10 MB at most. A larger file still comes by email or as a Drive link.',
  ],
}

export default note
