import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4336',
  date: '2026-10-01',
  title: 'People → Users → Account: real sign-in times and training boxes',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Sign-in column shows when each person last signed in: today, 12d ago, 2mo ago, or never. Before, every account read never signed in.',
    'The Training box is ticked for anyone in training mode, so you can see it and turn it off from the list.',
    'Helpers and subs no longer show their supervision twice on this list. The Supervision column says it.',
    'People without a login show one quiet dash, and every row fits on an iPad held upright.',
  ],
}

export default note
