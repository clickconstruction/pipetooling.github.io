import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4646',
  date: '2026-10-05',
  title: 'Legal portal: the firm reads a plain sentence when something breaks',
  kind: 'fix',
  highlights: [
    'When the attorney\'s portal fails unexpectedly, the firm now reads one plain sentence and a short reference, never the system\'s own error text.',
    'The reference is written beside the real error in the log, so the office can find it when the firm calls.',
    'The messages written for the firm stay as they were: an inactive link, a matter no longer with the firm, too many changes in an hour.',
  ],
}

export default note
