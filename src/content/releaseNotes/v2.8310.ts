import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8310',
  date: '2026-11-22',
  title: 'Legal portal: a phone number or a date in a contact is no longer read as a job',
  kind: 'fix',
  highlights: [
    'The firm reads a customer’s contact log about its own account. A contact that names only another job of that customer stays with the office.',
    'A job is named by its number where it stands as one, such as 1042, #1042 or job 1042. The same digits in a phone number, a date or a year, an amount, a street address or a count of days are no longer read as a job.',
    'Most jobs carry a three-digit number, so an area code or “120 days past due” could hold an account contact back from the firm. Those contacts now go.',
    'Nothing changes on the accounts with the firm today. Preview what the firm sees still shows exactly which contacts go.',
  ],
}

export default note
