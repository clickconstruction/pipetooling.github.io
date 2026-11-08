import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6728',
  date: '2026-11-08',
  title: 'Materials on site: the Needs you card tells the office what walked away this week and which boxes are due a count',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Needs you card on the Dashboard, and on Quickfill, carries two new lines for the office. One names the money of material that walked away this week across every job with a box, priced from the parts book, with the count of short lines when nothing is priced yet. The other counts the cages and boxes not counted in 14 days.',
    'Each line opens the Materials desk, or the one job’s page when a single job holds every box due or every shortfall.',
    'The figures are the desk’s own: the same ledger, the same price, so the card and Jobs → Materials never disagree.',
    'The guide for the materials desk names the two lines.',
  ],
}

export default note
