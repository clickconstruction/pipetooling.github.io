import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3611',
  date: '2026-09-19',
  title: 'Supervision, PR 1: one switch says who can run a job; Who\'s where marks who is supervising and what is unsupervised',
  kind: 'feature',
  highlights: [
    'Every helper and every subcontractor now carries one switch, "Needs supervision", on by default. Flip it off on Settings → Active accounts or from the ⋯ menu on People → Users when the office decides they can run a job. Only a dev, a master or an assistant can flip it, never on their own account.',
    'One rule follows from it: a job is covered on a day when someone on it does not need supervision. Masters always do. There is no leader to name and nothing to maintain.',
    "Who's where reads the switch: a green SUP mark on every head that can run a job, an \"unsupervised\" mark on a crew or a job with nobody like that, and a count of unsupervised job-days under each day of the week strip.",
    'Coming next in this train: the warning on a Dispatch block built without anyone who can run it, the supervisor\'s Dashboard (reports owed, crew hours read-only, monthly ratings), and the retirement of the Team leads list.',
  ],
}

export default note
