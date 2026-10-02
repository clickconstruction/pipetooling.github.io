import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4354',
  date: '2026-10-02',
  title: 'Procurement log: tap a line to change its house',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Tap a line on the Submittals procurement log to open its row’s Edit window right there, with that part ringed and its house box ready. No more scrolling up to the rows and back.',
    'Change the house, lead time or stage, then Save. The log keeps your place.',
    'Saving a row no longer rewrites a tag you did not change.',
  ],
}

export default note
