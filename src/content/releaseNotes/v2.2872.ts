import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2872',
  date: '2026-09-05',
  title: 'Inviting someone asks for their role — and can start them in training mode',
  kind: 'fix',
  highlights: [
    'Invite via email and Manually add user now open with no role selected. Pick one before Send or Create lights up — nobody gets Master access because a dropdown was left alone.',
    'Roles read as words everywhere: the dialogs, the Person Desk, and the invitation email itself now say "as a Helper" or "as a Master" instead of the raw code name.',
    'A "Start in training mode (read-only)" checkbox on both dialogs flags the account from its first minute, so a new hire can explore without being able to change anything.',
    'Changing a role from the Active Accounts list asks you to confirm first, the same way the Person Desk does; Cancel leaves the role as it was.',
  ],
}

export default note
