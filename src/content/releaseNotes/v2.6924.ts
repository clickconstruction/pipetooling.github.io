import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6924',
  date: '2026-11-11',
  title: 'Permits: every builder on the list, and the year on an older day',
  kind: 'fix',
  highlights: [
    'San Antonio’s permits now reach back to January 2025. Builders lists every name on them, 1,227 so far. It stopped at 1,000 before.',
    'The skim with houses shows every permit in the window. It also stopped at 1,000 in San Antonio and Austin.',
    'A day from another year says its year, as in Dec 17, 2025. A year of records no longer reads as if it all happened this year.',
    'Compare in Find their names counts where all of a name’s permits are, not only its newest 300.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
