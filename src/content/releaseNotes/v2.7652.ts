import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7652',
  date: '2026-11-17',
  title: 'Papers before a job opens: the prompt that stands in for the job until you sign',
  kind: 'feature',
  highlights: [
    'A job that requires papers now opens as a prompt until you have signed each one. It shows the job’s number and the papers, and nothing else of the job.',
    'Read and sign opens the paper. After you sign, Back to the job brings you to what is left, then to the job. You cannot clock in to that job before signing.',
    'Crew and subs see a locked job by its number and a lock in Job Mode, the schedule, the calendar and the clock in list. A Papers to sign line shows under Needs you.',
    'The prompt is the only lock for now. The lock in the database arrives with the next update.',
  ],
}

export default note
