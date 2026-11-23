import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8401',
  date: '2026-11-23',
  title: 'Job Summary: find a job’s supply house invoices by a part on the paper',
  kind: 'feature',
  highlights: [
    'The search on a job’s Invoices from Supply Houses now reads what is printed on each bill. Type a part, such as ball valve, or a supply house’s part code.',
    'A row found that way says On the paper and shows the line, with your words marked.',
    'An open bill lists the lines read from its paper beside the page. With a search on, the lines that match come first.',
    'This reads the bills whose lines the app has read, about nine in ten. A bill with no PDF is still found by its number, date and amount.',
  ],
}

export default note
