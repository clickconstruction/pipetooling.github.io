import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7224',
  date: '2026-11-13',
  title: 'Liens: a job with no clock hours is dated from its bill, not from the day it was made',
  kind: 'fix',
  highlights: [
    'A job with no approved clock hours and no last day of work set by hand now takes its lien month from its sent, unpaid bills. It used to take the month the job was made, so a job typed in weeks after its work counted every lien date from the wrong month. A job with no sent, unpaid bill still uses the month it was made.',
    'A bill is not a record of work: it is sometimes written before the job is done, and sometimes weeks after. So the app says dated from the bill, no clock hours wherever that month shows: the billed row, the Deadlines list, the Lien desk and the Lien window.',
    'An affidavit on such a month carries a line that says the month comes from the bill, with the door to set the last day of work. Its help sheet and its notice record ask about the month and no longer read On record. Nothing is held, and the affidavit’s wording is the same. No paper already drafted or approved was redrawn. Worth counsel’s eye.',
    'A bill typed in after the fact carries the day it was typed, so a job brought in from the earlier system may read the same month as before. Set its last day of work by hand: that day always counts first. The Lien desk’s lists follow after one database step the owner approves, and keep the month the job was made until then.',
  ],
}

export default note
