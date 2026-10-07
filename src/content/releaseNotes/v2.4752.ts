import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4752',
  date: '2026-10-06',
  title: 'GC mode: the scope book on real data',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The scope book opens from the GC projects page: every scope line we keep, by trade, with its section and its known exclusion.',
    'Change a line, add one, fold two lines that say the same thing, and save a project’s scope as a set. The next project starts from the set on its Each scope step.',
    'Only devs see it while the real build goes on.',
  ],
}

export default note
