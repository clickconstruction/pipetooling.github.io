import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4816',
  date: '2026-10-07',
  title: 'GC mode: the tables for what-if copies, rough schedules and templates',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule gets its last three tables: a person’s what-if copy of a schedule, the rough schedule we draw while we bid, and templates saved from earlier jobs. Each schedule can now point at the template it was drawn from.',
    'A template’s lines never change once saved, only its name and the day it is set aside, and a what-if copy is its own person’s alone. Only a dev can see them while they are built, and nothing reads or writes them yet.',
  ],
}

export default note
