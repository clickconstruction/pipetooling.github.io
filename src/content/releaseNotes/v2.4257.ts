import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4257',
  date: '2026-09-30',
  title: 'A worker can report a day the clock missed, instead of texting the hours in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers', 'superintendent'],
  highlights: [
    'Under the Job Mode card, and at the bottom of My Time: “Worked a day the clock missed? Tell the office.” Pick the day (back to the start of last week), when you started and stopped, the job, and one sentence on what happened.',
    'The form shows what the clock already has for that day and takes only the part it missed. It will not take a stop time that has not happened yet.',
    'The hours go to the office marked as typed by the person, and how many days late. They count once someone else approves them.',
  ],
}

export default note
