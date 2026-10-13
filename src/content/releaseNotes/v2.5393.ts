import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5393',
  date: '2026-10-12',
  title: 'Messages: a job’s activity inside a person’s thread, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A person’s thread can show the clock, the reports, the status and the billing of the jobs their lines are tied to. Each row says which job it is on.',
    'A job of theirs that no line points at stays out. On the tech’s phone the billing rows stay out too.',
    'The Job activity switch is on for the office and off on the phone, kept on each computer.',
    'Nothing on screen changes yet.',
  ],
}

export default note
