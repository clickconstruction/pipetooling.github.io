import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4122',
  date: '2026-09-29',
  title: 'Procurement log: the printed sheet reads as a letter to the GC',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Print the log and Record, print and copy open a sheet on the company letterhead — logo, tagline, phone and address — addressed to the GC with the project, its address, the schedule they gave us and who it is from.',
    'What we need from you sits above the table: the rows waiting on the GC, each with the date their approval has to come by to make its stage, and your own line first. The same list opens the copied email.',
    'Rows are grouped by stage with the stage’s needed-on-site date once, and every cell is in the GC’s words — Approved, Awaiting your approval, Returned for revision; 15 days ahead, 14 days behind, delivered Sep 26, we order by Oct 10, approve by Nov 10. Notes print the row’s note; on an update the changed rows carry an amber dot with what changed since.',
    'Print the log says “as of” a date and marks nothing; an update says its number and since when. The sheet ends with the room’s link and code and a line for the estimator to sign that it is true and current.',
  ],
}

export default note
