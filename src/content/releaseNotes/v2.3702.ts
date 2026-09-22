import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3702',
  date: '2026-09-21',
  title: 'People → Users is the one roster: Contact, Account and Pay lenses over the same rows',
  kind: 'feature',
  highlights: [
    'A lens switch beside the search on People → Users: Contact is the row you know; Account shows role, last sign-in, training mode and supervision, with the switches you may flip right there; Pay shows the wage, office rate, salary, record-hours and vehicle deal inputs, plus a Workday… button for salaried people.',
    'The Payroll tab\'s People pay config button now opens the Pay lens (People → Users → Pay). The old pop-up is gone; every row edits the same way, and people without a login stay visible on the Pay lens.',
    'Nothing changes about who may see wages or flip a switch — the same rules, on the roster instead of in three places.',
  ],
}

export default note
