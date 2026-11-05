import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6534',
  date: '2026-11-04',
  title: 'The Scoreboard prints a cost summary for the whole development',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'Press Print cost summary under the Scoreboard on a development’s Money look. The page opens in a print window, and the print window saves it as a PDF too.',
    'The page carries the site’s nine totals, a row per job, who put what in, the parts by bucket, the card charges by payee, the supply-house invoices and every other charge, with the estimates marked.',
    'The figures are the board’s own: the same rows, the same card rule, the same overhead day share. A read that did not land says so on the page instead of showing a zero.',
    'A job’s own cost pages print from the Job window’s Costs tab, as before.',
  ],
}

export default note
