import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6481',
  date: '2026-11-03',
  title: 'Every stretch a person worked is kept',
  kind: 'feature',
  highlights: [
    'A person has one start date and one end date. When someone left and came back, changing those dates wrote over their first stint.',
    'The app now keeps every stint. Ending employment closes the current one, and a return opens a new one beside it. Fixing a date changes only the current stint.',
    'Restoring an archived account can now leave their old roadmap tasks in Needs a person instead of giving them back. Nothing changes on screen yet; the Bring back window uses both next.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
