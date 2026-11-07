import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6635',
  date: '2026-11-07',
  title: 'Documents → Photos lists task card photos',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'Every photo taken on a task card shows on Documents → Photos with the others, newest first. A Task cards chip narrows the list to them, and the search finds a card by its title.',
    'A task card’s row reads the card’s title and where the card stood, as in At 75%, The finishing photo or Done when… Pipe is racked by size, with who took it and the time. Open the checklist is its door.',
    'The row says where the photo is, as every row does: In Drive with Open, On its way to Drive, or Not in Drive yet with the reason. When the Tasks folder is not set yet, Set the Tasks folder opens Where files go.',
  ],
}

export default note
