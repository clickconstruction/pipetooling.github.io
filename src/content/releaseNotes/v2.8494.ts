import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8494',
  date: '2026-11-24',
  title: 'Takeoffs: the lines keep their roomy look after a window is dragged narrow and back',
  kind: 'fix',
  highlights: [
    'On Bids → Takeoffs, dragging the window narrow and then wide again could leave the lines in their tight look, with no Actions heading, though they fit. They now go back to the roomy look.',
    'On an empty bid the strip’s Costed count is green, as it is on the rail.',
  ],
}

export default note
