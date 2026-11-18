import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7724',
  date: '2026-11-17',
  title: 'Checklist: the Manage tab is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Manage tab moved out of the big Checklist page into its own file, with the roadmap stage chip the tabs share.',
    'Nothing changes on screen. The tab draws the same page it drew before the move, checked mark for mark.',
    'The Checklist page is a fifth smaller, and Manage now has its first test: its sections, its pills, its search and its row menu.',
  ],
}

export default note
