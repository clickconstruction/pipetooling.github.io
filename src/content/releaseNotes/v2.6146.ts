import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6146',
  date: '2026-10-30',
  title: 'Your record’s items as a week strip (punch list #217, a prototype behind a switch)',
  kind: 'feature',
  highlights: [
    'A Week strip switch on the Dashboard’s Your record card draws each item’s pay week, Sunday to Saturday: a bar with its hours on each day you worked that job, today’s open session a striped bar with its hours so far on hover, a dot on a day a report of yours landed.',
    'The line under the strip says the week rule in a few words: no report from you this pay week. The Report, Set % and Fix day presses are unchanged.',
    'The switch is off until you press it and is remembered for you on this device. Nothing changes for anyone who leaves it off.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator', 'helpers', 'subcontractor'],
}

export default note
