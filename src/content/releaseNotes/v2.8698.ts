import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8698',
  date: '2026-11-27',
  title: 'Jobs: the Billing tab is gone, and its links open the Pipeline',
  kind: 'feature',
  highlights: [
    'The Jobs page no longer has a Billing tab. Nobody had opened it in months, and every bill is made on the Pipeline.',
    'An old link or bookmark to the tab opens the Pipeline and says so once.',
    'A job’s line items are on its window’s Bill tab. Its paid, billed and unbilled money is on its Pipeline row, and every job’s money is on Job Summary.',
    'Two things left with the tab: its search by a line item’s words, and its red Needs labor flag.',
  ],
}

export default note
