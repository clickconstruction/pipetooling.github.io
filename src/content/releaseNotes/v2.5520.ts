import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5520',
  date: '2026-10-14',
  title: 'Bids: every CountTooling project on the bid, on Edit Bid, the Bid Board and the Count sheet',
  kind: 'feature',
  roles: ['dev', 'estimator', 'master_technician', 'assistant'],
  highlights: [
    'Edit Bid gains a CountTooling projects list under the CountTooling Plans field: each project with who imported it, the day, what the copy covered and how many rows are its, with Open and a ×. Removing one keeps its rows on the bid; they just lose their project. A link typed by hand can be added.',
    'The first project is the bid’s own CountTooling link, so the Bid Board’s crosshair and every other reader stay as they were. The Bid Board draws one more link icon per further project, named by its project.',
    'The Count sheet gains a From tile and a From column: pills narrow the sheet to one project’s rows or to the rows typed here, and a row both people counted reads “both” with each share on hover.',
  ],
}

export default note
