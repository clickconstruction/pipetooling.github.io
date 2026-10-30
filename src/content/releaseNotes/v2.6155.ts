import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6155',
  date: '2026-10-30',
  title: 'Draft Payroll’s Cash Due as bars, a prototype behind a switch (punch list #217)',
  kind: 'feature',
  highlights: [
    'Draft Payroll has a Show the bars switch at the top of the window. With it on, each row’s Cash Due is a thin bar: green for money sent, blue for a report’s net still owed, hatched for an estimate from the hours with no report yet.',
    'The Total | Left sentence becomes the period’s bar under the dates, the same parts added up with a legend.',
    'An est. chip marks an estimated figure, a salary 8h chip marks flat salaried hours, and an amber dot sits on each row whose clock sessions still wait on approval. The amber banner becomes one chip in the button row.',
    'The switch is off by default and yours alone, remembered on this device. Nothing changes for anyone who leaves it off.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
