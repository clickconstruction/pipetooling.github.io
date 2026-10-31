import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6164',
  date: '2026-10-30',
  title: 'Other job charges keep the trash can on the first line',
  kind: 'fix',
  highlights: [
    'Each Other job charge on the Costs tab is two lines again: the date, the description, the amount and the trash can on the first, the memo under the description. The trash can had dropped onto a line of its own.',
    'On a phone the date takes the first line by itself, the description and the amount share the second, and the memo takes the third.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
