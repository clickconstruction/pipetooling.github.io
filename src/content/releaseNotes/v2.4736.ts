import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4736',
  date: '2026-10-06',
  title: 'Bids: the history knows an import from an edit',
  kind: 'infra',
  highlights: [
    'When counts are imported, cleared, filled from the book or pasted by a robot, the history now keeps which action it was, so 23 rows read as one import and not 23 edits.',
    'The Labor tab’s own bookkeeping is marked as the app’s doing, not laid at the door of whoever opened the tab.',
    'Nothing shows it yet. The History view that comes next groups and names each action from this.',
  ],
  roles: ['master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
