import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6350',
  date: '2026-11-02',
  title: 'A stage’s checklist stays with its line when a job is split or combined',
  kind: 'fix',
  highlights: [
    'Separate a job and each stage you move takes its checklist along: every answer with its name and time, the checks added for the job, and the skipped questions.',
    'Combine two jobs and the source’s checklists land on the target. They used to go when the source was deleted.',
    'A field report’s photos now move with the report in a combine, so a question one of them answered stays answered.',
    'A phone still showing the old job saves its answer on the job the stage is on now.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', 'primary'],
}

export default note
