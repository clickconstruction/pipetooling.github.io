import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4707',
  date: '2026-10-06',
  title: 'GC mode: the one press that makes a project writes all of it, or nothing',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database gains the function New project will call: the project, its trades with their scope lines and exclusions, and the first set of plans with every sheet and section go in together, or not at all.',
    'Nothing on a screen calls it yet. The New project page on real data is the next step of the GC mode real build.',
  ],
}

export default note
