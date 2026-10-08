import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4966',
  date: '2026-10-08',
  title: 'GC mode: the schedule’s chart is in the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule’s chart is now part of the app, as it was tried in the design spike: the bars and their links, the list a phone opens with, Print or PDF, Export, and the measures beside it.',
    'Nothing shows it yet. The Schedule window on each GC project, for devs first, comes next.',
  ],
}

export default note
