import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7315',
  date: '2026-11-15',
  title: 'Lien desk: the find box blends into the list',
  kind: 'feature',
  highlights: [
    'On By paper the find box is no longer a bordered pill. It is a quiet line on the list’s own background: the ⌕ and the words in the list’s grey, flush with the rows, with one hairline under it before the first pile head.',
    'Click into it and it wakes: the ⌕ turns strong and the hairline turns blue. Nothing moves, and the pile heads under it stay where they were.',
    'The / key badge shows only while the mouse is over the list or the box has the focus. The shortcut still works from anywhere on the desk, and a phone draws no badge.',
    'While you type, the count and the × clear sit at the right as before, in the same grey, with no filled circle until you hover the ×.',
  ],
}

export default note
