import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4694',
  date: '2026-10-06',
  title: 'Job window: the History tab is a calendar of the days people were on the job',
  kind: 'feature',
  highlights: [
    'Days on the job replaces the sideways day strip on a job\'s History tab. One month grid for every month the job had work, and the number in a day is how many people clocked in. Weekends sit back, today has a ring, a day still clocked in has an amber corner.',
    'One line says it: the days worked, from the first day to the last, the most people on one day, and the hours. Under it, Who lists each person with their days and hours. Press a name and only their days stay lit.',
    'Press a day to open the same day window as before: who was there, their times and hours, what the day cost, the reports filed.',
    'The calendar shows the whole job by default, not the last 180 days. Whole job, Last 90d, Last 365d and Dates… narrow it. The search box and the Expanded · Compact toggle, which belong to the Projects page, are gone from this tab. On a phone the months stack; the day list is retired.',
  ],
}

export default note
