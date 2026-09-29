import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4144',
  date: '2026-09-29',
  title: 'Submittals: the robot’s status row is two lines, with Cancel on the second',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'In the plans’ schedule card, the robot’s status row read as three stacked lines with Cancel alone at the bottom. It is now the sentence, then the task line (robot · read the schedule · queued) with Cancel or Dismiss at its right on the same line.',
    'The ready sentence reads “The robot read the schedule. Confirm the tags below.”',
  ],
}

export default note
