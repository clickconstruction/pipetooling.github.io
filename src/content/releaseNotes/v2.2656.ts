import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2656',
  date: '2026-09-02',
  title: 'Every outbound email, cataloged in Settings',
  kind: 'feature',
  highlights: [
    'Settings → Email templates now opens with a catalog of all 32 emails the app can send — grouped by area, with who receives each one, what it attaches, its live subject line, and whether the wording is editable yet.',
    'Real send stats per email type start accumulating from today, and five senders that never appeared in "Most recent emails sent" (bid pricing packages, recurring job reports, schedule-day emails, roster audits, task-reminder fallbacks) now log every send.',
    'This is step one of making every email\'s wording editable without a deploy — the next steps light up the "hardcoded" rows group by group.',
  ],
}

export default note
