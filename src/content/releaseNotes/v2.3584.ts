import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3584',
  date: '2026-09-18',
  title: 'Payroll: hours, reports, pay setup and bank names can be fixed on the record',
  kind: 'infra',
  highlights: [
    'Four new functions let a person or an agent void a pay report, clear or set someone’s hours for a date range, change their pay setup, or tie a bank name to a person — each with a written reason, each leaving an audit row with the before and after.',
    'A voided report takes its payments with it into the deleted-records archive, and a report whose payment is tied to a real bank send is refused rather than dropped.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
