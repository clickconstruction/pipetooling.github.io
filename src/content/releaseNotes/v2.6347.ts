import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6347',
  date: '2026-11-02',
  title: 'Stage checklists: skip a question on one job, add a check to the company’s list, and name its plan sheet',
  kind: 'feature',
  highlights: [
    'Open a job’s stage checklist and press Skip on this job on a company question that does not apply. Say why. It leaves that stage’s count, on the Pipeline too, and the company’s list stays whole. Put it back undoes it.',
    'On the Documents tab, press Add to the company’s list on a check added for one job. Every stage of that kind asks it from now on, and this job keeps its answer.',
    'The add box stays open for the next check, with a plan sheet and a why beside the words. A plan sheet reads as a chip that opens the job’s Plans folder. Move a job’s checks up or down with the arrows.',
    'An estimator can now add, skip and order checks on the jobs they priced. A superintendent or an estimator sees those presses only on their own jobs.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', 'primary'],
}

export default note
