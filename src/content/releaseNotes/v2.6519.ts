import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6519',
  date: '2026-11-04',
  title: 'People with no login read as such everywhere, and a notice can reach them',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On People → Users a person with no login folds behind “+ N more without a login” and counts in the group header as before, whether they were added today or came from the old roster. The sign-in column and the person’s desk header read “no login”.',
    'The pickers that hand someone an app task, a pin or an imitation list only people who can sign in. Crews, rosters, approvals and pay lists still list everyone.',
    'Archive, Restore, Merge a duplicate and Change the email work for a person with no login: nothing is banned or unbanned where there is no sign-in, and the address changes on the person alone.',
    'A notice to a person with no login is no longer refused, and the mails that go out to people skip anyone with no address.',
  ],
}

export default note
