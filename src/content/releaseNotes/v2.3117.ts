import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3117',
  date: '2026-09-07',
  title: 'Robots read plan sets filed as a Drive folder',
  kind: 'feature',
  highlights: [
    'A bid whose plans link points at a Google Drive folder now works for the robot estimators: the folder\'s PDFs, in name order, are the plan set. Before, only a link to a single PDF file counted, and folder links were flagged "unreadable by robots".',
    'One PDF in the folder is served as-is; several are stitched into one plan set on the way out. Very large sets (over 60 MB combined) are served one part at a time instead of merged.',
    'The "plans readable by robots" check now says what it found in the folder — how many PDFs and their names — or tells you the folder is empty or not shared with the intake account.',
  ],
}

export default note
