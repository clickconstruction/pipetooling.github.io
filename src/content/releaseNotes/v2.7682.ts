import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7682',
  date: '2026-11-17',
  title: 'Supply houses: Accounts payable keeps counting every bill as the book grows',
  kind: 'fix',
  highlights: [
    'Accounts payable now reads the book of bills a page at a time. Before, a book past 1,000 bills would have been cut short without saying so, and the total would have been low. No book is that large yet.',
    'Opening a house reads the jobs on that house’s bills only, where it used to read every job on every bill in the company.',
    'Opening a house is quicker. It no longer reads each purchase order’s lines, which the page never showed.',
  ],
}

export default note
