import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7721',
  date: '2026-11-17',
  title: 'Edit Job: the top of the Bill tab is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Billing title, its saving line and the New Job money bar moved out of the big Job form into their own file.',
    'The saving line was written twice in the form. It is written once now.',
    'Nothing changes on screen. The form was compared before and after in ten states, and each one came out the same.',
  ],
}

export default note
