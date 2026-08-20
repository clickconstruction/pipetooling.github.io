import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1916',
  date: '2026-08-20',
  title: 'Pipeline New view: collected card scoped, quieter queue header',
  kind: 'fix',
  highlights: [
    'The "collected · last 8 wks" card now shows for devs and master technicians only — other roles see the three billing cards.',
    "The dollar total next to Today's money moves is gone — the moves speak for themselves.",
  ],
}

export default note
