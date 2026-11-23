import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8391',
  date: '2026-11-23',
  title: 'Job Summary: search a job’s supply house invoices and copy a link to one',
  kind: 'feature',
  highlights: [
    'On a job’s Invoices from Supply Houses, a link icon sits left of each invoice number. Press it and a note reads Link copied to clipboard. The link opens the bill for a teammate in the office who is signed in.',
    'A list of eight or more invoices has a search box. Type a supply house, an invoice number, a day, a month or an amount. The count beside it says how many are left and what they add up to, and a chip under it shows one supply house alone.',
    'The cents are drawn smaller than the dollars, and a date from this year shows no year.',
    'A bill with no PDF now says no PDF beside its number. Its number used to open the supplier’s home page.',
  ],
}

export default note
