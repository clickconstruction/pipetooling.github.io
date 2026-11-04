import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6492',
  date: '2026-11-04',
  title: 'A combine carries the texts, the mail, the sub sheets and every other job link to the combined job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Combining two jobs now moves every text, call, email and team note tied to the source job onto the target. Before, those lines fell back to the person with no job on them.',
    'The sub labor sheets, the certified mail, the statements of charges and the charge adjustments on the source go to the target too. A moved sub sheet shows the target job number.',
    'So do the smaller links a job keeps: an owner records request, a profit-share posting, a bank deposit label, a rating ask, the watcher emails, the schedule history, the AR cases and a GC project link to the job.',
    'The combine guide now says what moves.',
  ],
}

export default note
