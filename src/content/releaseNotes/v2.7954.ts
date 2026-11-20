import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7954',
  date: '2026-11-19',
  title: 'Messages: a Drive link’s preview picture is not a file to keep',
  kind: 'fix',
  highlights: [
    'Gmail adds a small picture of a Google Drive link to an email. It no longer makes Keep this mail as a paper or Keep its files on the bid show on an email with nothing else to keep.',
    'When an email has a real file too, the preview picture is listed in the form with its tick off. You can still tick it.',
  ],
}

export default note
