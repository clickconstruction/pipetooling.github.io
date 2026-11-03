import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6360',
  date: '2026-11-02',
  title: 'Send a stage check to Dispatch from the phone, with the job, the stage and the check on it',
  kind: 'feature',
  highlights: [
    'On a stage checklist, press Send to Dispatch under the open question when you cannot answer it. A sheet opens on top with the job, the stage and the check already filled in. Pick why and say what Dispatch should know.',
    'Can’t do it marks a stopped crew, so the request leads the Dispatch inbox. The row then reads With Dispatch with the reason and how long, and still takes an answer.',
    'In the Dispatch inbox the request wears a Stage check tag and two presses. Open the job opens the job window. Open the check opens that stage’s checklist with the crew’s row open, ready to answer, skip or take off.',
    'One check goes to Dispatch once: a check already sent wears the chip in place of the press.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', 'primary'],
}

export default note
