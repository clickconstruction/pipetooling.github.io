import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6200',
  date: '2026-10-31',
  title: 'The bids inbox reader leaves out a newsletter by the unsubscribe line at its foot',
  kind: 'fix',
  highlights: [
    'A newsletter sent person-to-person, with none of the list headers, now stays in Gmail with no label when its last lines carry an unsubscribe line, view this email in your browser, you are receiving this because, or manage your preferences. It no longer lands in New as Who is this?.',
    'An invitation to bid from a GC’s platform is still taken. Its footer names your own choice about one contractor’s invitations, not a list, and the reader never reads it as one.',
    'Nothing in Gmail is deleted, moved or marked read, as before.',
  ],
}

export default note
