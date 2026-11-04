import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6472',
  date: '2026-11-03',
  title: 'Each teammate has a logbook toward their next license',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Open a teammate’s logbook from the Licenses tab or their desk. It shows each license they hold and how close they are to the next one.',
    'An hour counts toward the trade of its job. Plumbing and electrical count hours, HVAC counts months, and office time counts toward nothing.',
    'A yellow card names hours worked in a trade with no license on file, so a registration that was never added stands out.',
    'Print a summary sheet with a signature block for each trade, or the full week-by-week log, to go behind the board’s own form.',
  ],
}

export default note
