import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5450',
  date: '2026-10-13',
  title: 'Messages: quick replies for the tech’s phone, in Spanish, with blanks the app fills',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Tick On the tech’s phone on a line for customers, and give it a short name. The Phone tab sets the order.',
    'A line for customers takes its Spanish. The list marks a line with no Spanish as no es.',
    'Chips put blanks like {first} in a line, and a preview shows it as it would go.',
    'The reply box fills their first name, yours and the job’s name. It waits until you fill any blank it cannot.',
  ],
}

export default note
