import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8029',
  date: '2026-11-20',
  title: 'Pay: the Employment tab and the pay guides name a salaried person’s own week',
  kind: 'fix',
  highlights: [
    'On People → Pay → Employment, the line beside the Salaried switch now names the days and hours that person is credited, such as 8 h Mon to Thu, 4 h Fri. It said 8 hours on weekdays for everyone before.',
    'The Pay setup card says a week that is not 8 hours on weekdays is set on the person’s desk, under Edit pay setup.',
    'Four help guides no longer say every salaried person is paid 8 hours a weekday: run the pay week, manage employment dates, hire someone and see everyone’s pay setup.',
    'Draft Payroll’s small line under a salaried figure already read the person’s own week. Its guide now says so: salary 8h, salary 6h or salary 36h wk.',
  ],
}

export default note
