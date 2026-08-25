import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2269',
  date: '2026-08-25',
  title: 'Waiting For: your blocked tasks, grouped',
  kind: 'feature',
  highlights: [
    'The ⏳ list on Today and your Dashboard is now called Waiting For, and it groups your blocked tasks under the step that\'s holding them — the blocker, who\'s on it, and the stage said once, your tasks as one-liners beneath.',
    'Tasks queued behind another waiting task carry a small "then", so the unlock order reads at a glance.',
    'Only the first three groups show; "…and N more steps ahead" expands the rest.',
    'The rarely-used Upcoming section (future-dated items) is hidden from Today for everyone but devs.',
  ],
}

export default note
