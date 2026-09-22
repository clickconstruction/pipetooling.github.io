import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3698',
  date: '2026-09-21',
  title: 'Pay lists only show people: one roster answer for the Hours grid, Draft Payroll and the team labor total',
  kind: 'fix',
  highlights: [
    'The Hours grid, Draft Payroll, the Earlier-weeks scan, the cost matrix, the Dashboard team labor card, Quickfill Hours and the Review tab now take one shared answer to "who is a person". A sample account, a digital twin or an archived person with a pay setup row no longer appears on any of them — the way a test account put 40 hours a week into every total for nine weeks cannot happen again.',
    'A salaried person who has been archived gets no more automatic clock sessions, and the every-30-minutes approval that turns those sessions into paid hours skips archived accounts.',
    'Nothing changes for anyone on the roster today: the same people, the same hours, the same order.',
  ],
}

export default note
