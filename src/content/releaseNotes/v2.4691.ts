import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4691',
  date: '2026-10-06',
  title: 'GC mode: the tables for plan sets and questions about the plans',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database gains the tables a GC project’s plans will live in: each set of plans with its Drive link, what the set did to every sheet and section, the questions asked about the plans, and which companies each set reached.',
    'Nothing on a screen reads them yet, and only a dev can touch them. New project on real data is the next step of the GC mode real build.',
  ],
}

export default note
