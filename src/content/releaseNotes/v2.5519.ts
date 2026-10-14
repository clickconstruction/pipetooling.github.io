import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5519',
  date: '2026-10-14',
  title: 'Bids: a second CountTooling count combines with the bid instead of replacing it',
  kind: 'feature',
  roles: ['dev', 'estimator', 'master_technician', 'assistant'],
  highlights: [
    'When two people count parts of one plan in separate CountTooling projects, the second copy’s review opens in Combine: a row both counted adds up and its pages join, new rows add, and the first counter’s rows stay under Only on the bid. Add to it is the default; Replace on a row takes the copy’s count instead.',
    'A copy from a project the bid already has opens as a re-copy. It moves only that project’s share of each row, keeps the other project’s part, and removes only the rows that were its alone.',
    'The bid remembers every CountTooling project behind its counts. A bid imported before this adopts its one link as its first project on the next import. The first project’s link stays the bid’s CountTooling link everywhere it is read.',
    'Undo still covers the whole import, including the project it registered.',
  ],
}

export default note
