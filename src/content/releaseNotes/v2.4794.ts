import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4794',
  date: '2026-10-07',
  title: 'Uncollectible: the Legal desk knows a bill the office gave up on (step 5 of 6)',
  kind: 'feature',
  highlights: [
    'The Legal desk\'s rail lists accounts the office gave up on under Given up on. You can read them like any other, but they are never marked attorney-ready.',
    'Closing a matter as uncollectible on the Legal desk marks its jobs Uncollectible too, so the Pipeline band, the totals and the Lien desk agree with the matter.',
    'Marking a job Uncollectible from the Pipeline while the firm holds the account shows a warning: do it from the Legal desk instead, or pull the matter back first.',
  ],
}

export default note
