import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6922',
  date: '2026-11-10',
  title: 'Bid Board: set or change a bid’s links in its Files window',
  kind: 'feature',
  highlights: [
    'A grey icon on the Bid Board now opens the bid’s Files window with a box ready for that link. Paste the link and press Save the link. The icon turns blue.',
    'Change on a row opens the same box with the link the bid has now, so a wrong link can be fixed from the board.',
    'A bid with no project folder can get one from the window. Make the project folder makes it in the company’s shared Drive and fills in the bid’s link.',
    'Add a set on the Plans row opens the bid’s plan sets right in the window.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
