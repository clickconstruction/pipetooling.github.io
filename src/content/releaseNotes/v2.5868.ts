import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5868',
  date: '2026-10-26',
  title: 'Quickfill: three fixes from the first live look',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Today’s lines now counts only your own lines. The owner’s calls still sit folded under it, but they no longer keep Done dark on a day your lines are clear. The station also has a Next line, the first of your lines.',
    'While a station is still counting, Done and Worked it wait, dimmed, and say counting. Before, the bar offered Looked as if the station had no count, and a press then saved a mark with no count.',
    'On a Saturday or a Sunday the Dashboard’s office’s round card says Weekend and names the last round. It no longer says No round yet today.',
  ],
}

export default note
