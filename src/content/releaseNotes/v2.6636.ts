import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6636',
  date: '2026-11-07',
  title: 'A sub’s sheet lines make a signed hours statement too',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'The Hours statement window lists the subs on a job’s sheets beside the people who clocked there, each by their sheets. A sub never punches, so their paper reads the sheets’ lines: the fixture, the agreed hours, the line’s rate and amount, one group a sheet.',
    'Paid reads per sheet: the sheet’s total and the payments recorded against it, with their memos. The attestation is the sub’s, for their company when it names one.',
    'A sub’s paper is always as paid: the charged switch is held with a line saying why. Until now a sub’s paper was made by hand.',
    'On a sub’s desk the window lists the jobs on their sheets too.',
  ],
}

export default note
