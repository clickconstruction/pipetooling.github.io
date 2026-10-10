import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5147',
  date: '2026-10-10',
  title: 'GC mode: our own crew’s Pipeline job and its clock-ins, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A trade our own crew does on a GC job can name the Pipeline job it runs on. The screens that use it come next.',
    'The daily log can count how many of our people clocked in on that job each day. It reads a number only, never a name or hours.',
  ],
}

export default note
