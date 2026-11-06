import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6585',
  date: '2026-11-06',
  title: 'Any job can carry a target: the Target line on the job window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'primary'],
  highlights: [
    'The job window’s Job tab shows the job’s target in hours: the expected hours the office set, else the labor budget’s hours, else No target yet. Every job has the line, not only the projects on the board.',
    'The leader and the office press Set a target or Change the target, type the hours and say why. Back to the budget clears it. The crew reads the line and the reason.',
    'A target is what the crew’s hours are counted against on a finished job. A job that finishes with no target is named as not counted, never guessed.',
  ],
}

export default note
