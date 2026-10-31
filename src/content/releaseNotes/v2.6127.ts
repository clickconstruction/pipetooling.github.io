import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6127',
  date: '2026-10-30',
  title: 'A report on a ZZ test job reaches no one',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Saving a report on a ZZ test job used to email everyone on the every-report list and buzz every phone opted in for that kind of report, the same as a real job’s report. The two sends now read the job first and hold back when its name, or its customer’s, starts with ZZ — the same rule the Pipeline hides test jobs by.',
    'Send now on a person’s report emails leaves those reports out too, and says how many it left out.',
    'Real jobs are unchanged: the same people get the same emails and pushes.',
  ],
}

export default note
