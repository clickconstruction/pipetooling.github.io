import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3683',
  date: '2026-09-21',
  title: 'Lien desk: every open month is back on the notice (a same-day fix)',
  kind: 'fix',
  highlights: [
    'For about an hour this afternoon a job’s later months dropped off the Lien desk — job 258 showed July without August. An update meant only to keep missed months in sight had reverted an older widening by mistake.',
    'Restored: once any month of a job is in the desk’s window, every unnoticed month with an open window rides along, and a job with a billed invoice counts even if its status is not yet billed. Missed months still stay in sight until noted.',
  ],
}

export default note
