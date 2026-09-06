import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2957',
  date: '2026-09-06',
  title: 'Guides: six sections instead of fourteen',
  kind: 'fix',
  highlights: [
    'The Guides browser (Settings → Guides, or the ? icon) had grown eight stray sections — "Field" beside "Field Work", "Jobs" and "Scheduling" beside "Jobs & Scheduling", a lone "Settings", "Money", "banking" and "people". Thirteen guides moved home; there are now exactly six sections.',
    'Two guides named buttons by old labels: the hours backlog guide now says "Approve all", and the ready-to-bill guide says "Create Stripe invoice", matching what you tap.',
  ],
}

export default note
