import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7033',
  date: '2026-11-12',
  title: 'The Pipeline’s search box fits a phone screen',
  kind: 'fix',
  highlights: [
    'On a phone the search box takes a full line of its own under the buttons, so there is room to type.',
    'A filter chip in the box shortens its words with an ellipsis when the box is narrow, instead of pushing the page sideways.',
  ],
}

export default note
