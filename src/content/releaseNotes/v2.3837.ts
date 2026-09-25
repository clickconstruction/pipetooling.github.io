import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3837',
  date: '2026-09-25',
  title: 'Job Parts Tally: a controller’s “Mark payroll” sticks',
  kind: 'fix',
  highlights: [
    'When a controller or pay-approved leader marked a tally transaction as payroll, it saved — but after the page reloaded the row still sat under the unlinked transactions with its Mark payroll button, and there was no Payroll ✓ or Unmark on it. Only a dev saw the mark.',
    'Everyone who can mark payroll now sees the Payroll ✓ rows, the payroll total chip and Unmark, and the unlinked count matches the Dashboard.',
    'The “Create rule…” button in the Mark payroll confirmation shows only for devs, who are the ones who can open the payroll rules. For everyone else it used to close the confirmation and do nothing.',
  ],
}

export default note
