import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6571',
  date: '2026-11-06',
  title: 'A stage checklist files itself as a record at the last answer: a record number, the sheet as paper, a PDF in the job’s Drive folder, Amend as a new version, and Print the checklists (punch list #237, PR 3)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', 'primary'],
  highlights: [
    'When the crew answers the last question on a stage, the checklist files itself as a record numbered CL-<job>-<n>, with that answer’s time. The sheet turns to paper: the record line, every answer with its name, time and mark, and nothing to press.',
    'A PDF of the record lands in the job’s Drive folder within a few minutes, each version its own file; the Documents tab’s Stage checklists section reads Filed with the record line and Open in Drive.',
    'Amend on the Documents tab opens a filed stage again as the next version with a reason; adding a check, skipping a question or taking a signed answer back does the same by itself, and the filed version stays as it was.',
    'Print the checklists beside the section’s heading draws every stage on one light paper, filed ones from their record and open ones as they stand.',
  ],
}

export default note
