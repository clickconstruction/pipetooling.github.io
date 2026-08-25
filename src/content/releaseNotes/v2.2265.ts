import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2265',
  date: '2026-08-25',
  title: 'Roadmap sync fix',
  kind: 'fix',
  highlights: [
    'Fixes the roadmap→checklist sync, which errored from the moment v2.2264 was applied — step-by-step list pruning and new-task materialization work as intended now.',
  ],
}

export default note
