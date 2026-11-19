import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7829',
  date: '2026-11-18',
  title: 'Pay: a salaried wage shows what the week comes to',
  kind: 'feature',
  highlights: [
    'On a person’s sheet, a salaried wage now reads with the days and hours of the week and the pay for the week, such as 8 h Mon to Fri · $300.00 a week.',
    'Payroll pays a salaried person each day of their own week. Everyone is on 8 hours, Monday to Friday, today, so no pay report changes.',
    'On Draft Payroll the small salary line under a figure names the person’s own day or week.',
    'Setting a different week comes next, once job costs read it too.',
  ],
}

export default note
