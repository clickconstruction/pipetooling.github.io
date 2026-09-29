import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4106',
  date: '2026-09-29',
  title: 'Assistants see fuel on a job',
  kind: 'fix',
  highlights: [
    'Assistants now see a job’s fuel as its own ⛽ line, the same as owners and controllers — it used to be folded into card charges for them.',
    'Editing which bank categories count as fuel stays with Banking.',
  ],
}

export default note
