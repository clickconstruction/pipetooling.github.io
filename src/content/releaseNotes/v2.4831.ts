import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4831',
  date: '2026-10-07',
  title: 'GC mode: the tables for billing the customer',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode gets its billing tables: the customer’s price as signed by line, change orders to the customer, our pay applications as each went with their lines, reminders to pay, interest bills and the customer’s acceptance of the work.',
    'A project gains its retainage and when it drops, interest on late bills, the late fee a day and the days to pay. Marking our contract with the customer signed keeps the price by line in one step.',
    'A pay application never changes once it went, but for the architect’s certificate. Only a dev can see these while they are built, and nothing reads or writes them yet.',
  ],
}

export default note
