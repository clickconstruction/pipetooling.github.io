import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4217',
  date: '2026-09-30',
  title: 'The Bridge: Vectors by the day — was each person’s day worth it',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Under Vectors on the Bridge, a new grid draws one cell per field person per day for a month: green when the day’s hours earned more than they cost, red when they cost more, the shade by dollars per hour, with a week sum after every Saturday and the month at the end.',
    'Office and bid days show grey with their hours — they cost a wage and earn nothing here, so they are never judged. A salaried person’s day costs the flat workday, the way payroll prices it.',
    'Hover a cell for the split: the jobs worked, each at its earned rate beside the wage, and whether any of it rests on a job with no % complete. ‹ › steps back a month at a time.',
    'A red day is a job’s verdict, not a person’s: every hour on a job earns the same rate, so a day goes red only when the job is priced under the wage, has no contract price, or has run past its expected hours.',
  ],
}

export default note
