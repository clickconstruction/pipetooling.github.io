import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4281',
  date: '2026-09-30',
  title: 'Hours added in bulk: when one person types hours onto several days at once, Needs you says so',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Dashboard’s Needs you gets a red item, Hours added in bulk, when one person types hours onto two or more days inside an hour — who typed, for whom, which days, how many hours, and how many days still wait. Whoever typed never sees their own burst; everyone else who approves hours does.',
    'Look at them opens the approvals queue on Typed by hand, narrowed to that person’s typing. Nothing is blocked by the notice; it is so a second person sees it the same day.',
    'Snooze 24h and Dismiss until count increases, like the bulk deletion notice.',
    'Settings → People & teams → Bulk hours alert (dev): the switch, how many days make a burst, within how many minutes, and how far back it looks.',
  ],
}

export default note
