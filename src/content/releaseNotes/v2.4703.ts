import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4703',
  date: '2026-10-06',
  title: 'GC mode: the first tables, for projects, trades, scope and the scope book',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database gains the tables a GC project will live in: the project itself beside its projects row, its trades, each trade’s scope lines and exclusions, and the four lists the scope book keeps by hand.',
    'Nothing on a screen reads them yet, and only a dev can touch them. New project on real data is the next step of the GC mode real build.',
  ],
}

export default note
