import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3602',
  date: '2026-09-18',
  title: 'Pipeline loads lighter: the row details arrive in one request instead of four',
  kind: 'feature',
  highlights: [
    'The materials, fixtures, last scheduled day and estimate banner that fill in under each Pipeline row now come back in one request per board load, instead of four separate reads chunked by 150 jobs.',
    'Your permissions apply exactly as before: the new read runs as you, so a row you could not see is still not there.',
    'If the one request ever fails, the board quietly falls back to the four reads it used until now — nothing goes missing.',
  ],
}

export default note
