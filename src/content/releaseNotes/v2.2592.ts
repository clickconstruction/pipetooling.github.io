import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2592',
  date: '2026-09-01',
  title: 'Estimate drafts save themselves',
  kind: 'feature',
  highlights: [
    'Draft estimates and change orders now autosave about a second and a half after you stop typing — a reload (even a hard one) no longer wipes your work.',
    'Switching away to another tab saves immediately, so running off to look something up is safe.',
    'A small "Autosaved" note appears next to Save draft; if autosave ever fails you\'ll see "Autosave failed — press Save draft".',
  ],
}

export default note
