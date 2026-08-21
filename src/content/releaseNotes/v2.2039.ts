import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2039',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Checklist: complete a task right from its activity panel',
  highlights: [
    'The Add-a-note box on every expanded task now has a green second button: with a note typed it reads ✓ Post & complete (note lands, task completes, one tap); empty, it reads ✓ Complete.',
    'This gives the Manage tab something it never had — a way to complete a task at all — and works on Review and Today too.',
    'Completing this way behaves exactly like checking the box on Today: watchers get notified and repeat-after-completion tasks schedule their next occurrence.',
  ],
}

export default note
