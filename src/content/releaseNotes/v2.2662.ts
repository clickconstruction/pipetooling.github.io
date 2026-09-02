import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2662',
  date: '2026-09-03',
  title: 'See email wording as the actual email before saving',
  kind: 'feature',
  highlights: [
    'The email template editor has a new "Open as email" button — it opens a new tab showing your current wording inside a real-looking email, with sample data filled into the variables, even before you save.',
    'Digest emails preview your subject and intro above a clearly-marked sample data table, since their real tables are built from live jobs at send time.',
    '"Test Email" remains the byte-for-byte check — the preview is the fast look, the test send is the proof.',
  ],
}

export default note
