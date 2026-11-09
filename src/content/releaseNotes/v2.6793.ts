import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6793',
  date: '2026-11-09',
  title: 'The dev seat updates a job and moves it along the Pipeline',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now change a job from the MCP seat as Edit Job does: the plan shows every column before and after, drops the ones already holding their value, and refuses a plan that changes nothing. A column changed by anyone between the plan and the apply refuses the apply.',
    'The status moves the Pipeline’s own way, one step at a time through the same rule the board uses, and the reply says where the job stands if a step is refused. A step back from Ready to Bill says first that it deletes the job’s Ready to Bill lines.',
    'Billing the job from the seat is the last step of this road.',
  ],
}

export default note
