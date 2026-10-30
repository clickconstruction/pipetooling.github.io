import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6112',
  date: '2026-10-29',
  title: 'Other job charges carry a date and a memo',
  kind: 'feature',
  highlights: [
    'Each Other job charge on the Costs tab now has a date on its left, the day the charge applies to. A new row gets today’s date, and you can clear it.',
    '“+ memo” under a charge opens a line for where the number came from and what would replace it, so the description can stay the short label that prints.',
    'The Job tab’s list and the printed Costs packet show the date and the memo. A cost batch can set both when it writes an ESTIMATE charge.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
