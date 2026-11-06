import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6560',
  date: '2026-11-06',
  title: 'Machines go on the schedule with the job, and the phone’s day asks whether each one arrived and how it was left',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'helpers', 'assistant', 'controller'],
  highlights: [
    'When Dispatch puts a job on someone’s day, the block editor has an Equipment on this job row. Add a machine lists every machine with where it is, in the yard, on a job, held, or a rental with its due-back day, and reads red when one is already planned on another job that day. Who brings it sits beside each.',
    'The block on the week board, the day cells and the phone’s agenda wear a chip per machine, red with the other job’s number when double-booked.',
    'I’m here ends with Is E-12 here? for each machine planned today: Here puts it on the job and opens the walk, Coming later leaves the stop on the rail, Not coming says why for Dispatch. The day rail counts the walk and the leaving check as stops under the job.',
    'The clock-out review lists each machine on the job: Leaving E-12 opens the leaving check with where it is tonight, and a machine never checked today says so.',
  ],
}

export default note
