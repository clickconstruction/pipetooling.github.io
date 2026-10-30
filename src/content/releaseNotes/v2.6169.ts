import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6169',
  date: '2026-10-30',
  title: 'More than one set of plans on a bid, and the Bid Board offers them by name',
  kind: 'feature',
  highlights: [
    'Edit bid → Plans has a Plan sets list. Add a set with its own name, date, memo and Drive link. The app reads the link at once and shows the file’s name and size, or how many PDFs a folder holds.',
    'The Plans link above the list stays the one set the robot reads and the Plans panel searches. Press Robot reads this set on another set to switch; the set carrying that link wears a chip.',
    'On the Bid Board the plans icon opens a bid’s one set as before. With two or more sets it opens a window that lists each by name, date, memo, file name and size, with Open on each and Edit bid at the foot.',
    'Plans stay Drive links. Nothing about how the robots read them changes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
