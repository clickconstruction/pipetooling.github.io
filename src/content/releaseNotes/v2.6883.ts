import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6883',
  date: '2026-11-10',
  title: 'Bid Board links keep their place, and bid photos read by name',
  kind: 'fix',
  highlights: [
    'Every icon in the Bid Board’s Links column now keeps its own place. The camera comes first, then the folder, the plans, CountTooling and the bid submission. A link a bid does not have leaves a gap, so each icon lines up down the column.',
    'In a bid’s Photos window, a picture the app filed from a text or a report now shows by its caption and who sent it. Before, several photos read the same.',
    'The camera’s count on the board updates when the window finds photos already in the bid’s Drive folder.',
    'Dragging photos onto a bid’s Photos window turns the whole window into the place to drop them.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
