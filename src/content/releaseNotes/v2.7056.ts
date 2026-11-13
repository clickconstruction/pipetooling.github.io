import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7056',
  date: '2026-11-12',
  title: 'Bills sent: print the list or save it as a spreadsheet',
  kind: 'feature',
  highlights: [
    'Print on Bills sent prints what the list shows, with its days, totals and each line\u2019s words.',
    'Download CSV saves the same lines as a spreadsheet file, one row a send, for the accountant or counsel.',
    'Both follow the search box and the chip you pressed, so you can take out one customer or one kind of send.',
    'The bills with no send on record come along in both.',
  ],
}

export default note
