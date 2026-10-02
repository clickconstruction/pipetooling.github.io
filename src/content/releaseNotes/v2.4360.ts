import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4360',
  date: '2026-10-01',
  title: 'CI catches a window that closes the window behind it',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every pull request now runs the nested-windows check. It fails when a window drawn inside another window lets a click outside it close the window behind too.',
    'The failure points at the line where the inner window is drawn. The fix is one line in that window’s backdrop.',
    'When the window behind should close too, a comment on the line above the inner window says so, with the reason.',
  ],
}

export default note
