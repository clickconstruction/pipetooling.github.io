import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6171',
  date: '2026-10-30',
  title: 'The Legal desk header reads the firm’s name on a phone',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a phone the Legal desk header showed only the firm segment’s quiet county tail, with the firm’s name squeezed to nothing and Emails and Portal link drawn over the tail. The name now always reads.',
    'When the segment is tight, the county tail shortens first and the name only after it, with an ellipsis, on the phone and on the computer alike.',
  ],
}

export default note
