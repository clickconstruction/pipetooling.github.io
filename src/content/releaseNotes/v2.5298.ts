import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5298',
  date: '2026-10-12',
  title: 'GC mode: Customers shows every customer by step and by company',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'GC projects has a Customers view beside Trade partners.',
    'By step shows every customer on the step of their flow, with tiles for setting up, bidding and building.',
    'By company gives each customer one row, with the last time they opened their page.',
  ],
}

export default note
