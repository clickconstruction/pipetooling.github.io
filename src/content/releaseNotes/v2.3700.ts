import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3700',
  date: '2026-09-21',
  title: 'End employment finishes everything in one place: the final pay report, the salary schedule, customers, the account and the roster row',
  kind: 'feature',
  highlights: [
    "On a person's desk, End employment now generates the final pay report right from the checklist — from the day after their last report through the end date — instead of sending you to Payroll.",
    'A salaried person who leaves stops being salaried: the checklist clears their workday template and turns the pay row hourly, and it waits for the final report first so those days are still paid.',
    'Customers on the account\'s name are counted in the footer; the default moves them to the company owner when the account is archived, or you can keep them where they are.',
    'Finishing archives both halves of the person — the login account and the roster row — when you ask it to, and the desk\'s Archive… button opens this same flow for everyone who may archive. Nothing routes through Settings any more.',
  ],
}

export default note
