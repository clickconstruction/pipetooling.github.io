import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6362',
  date: '2026-11-02',
  title: 'A checklist door on the Pipeline row: see every stage’s checklist and answer, add or skip from the board',
  kind: 'feature',
  highlights: [
    'Every Pipeline row with a Rough In, Top Out or Trim Set stage now carries a checklist icon under Edit. Amber with the count while a question is left, green once every stage is filled, grey while the stages have no questions yet. Rest on it to read each stage.',
    'Press the icon, or the amber stage name under the bar, and the job’s checklists open beside the row: every stage with its count, the open rows with Yes, No and Not here, and the office’s Add a check, Skip on this job and Take off. Each press saves under your name, and the row’s icon moves when the sheet closes.',
    'Open on the job at the foot goes to the job window’s Documents tab for the rest. On a phone the ⋯ sheet has the same Checklists line, with the count beside it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator'],
}

export default note
