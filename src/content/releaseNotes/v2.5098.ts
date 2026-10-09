import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5098',
  date: '2026-10-09',
  title: 'Bids: Undo takes back a whole change in History',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
  highlights: [
    'In a bid’s History, a line of several changes, such as an import or a brush stroke, has Undo for anyone who can edit the bid. One press takes the whole line back.',
    'Changed values go back, removed rows come back, and rows the line added are removed.',
    'Rows Undo removes go to the delete archive, each with its own Put back, and History lists your Undo as a line you can undo too.',
    'When a line cannot be taken back whole, such as an import whose rows were priced since, the line says why instead.',
  ],
}

export default note
