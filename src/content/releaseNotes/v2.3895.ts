import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3895',
  date: '2026-09-27',
  title: 'Phone fixes: past-due chips, customer rows, the move sheet’s days',
  kind: 'fix',
  highlights: [
    'On a phone, a supply house’s overdue invoices show their full past-due chip; it was being cut short under long invoice numbers.',
    'Customer rows show the address on one line and the jobs, balance and last activity on the next, so a long address no longer hides them.',
    'In Dispatch Mode’s Schedule, the move sheet shows one week of days that fit the screen; pick any other date from the date box.',
    'On Subs → Pay, a sheet’s reason can take two lines instead of being cut off.',
  ],
}

export default note
