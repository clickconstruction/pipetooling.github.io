import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3638',
  date: '2026-09-20',
  title: 'Behind the scenes: the money math moves where a server can read it',
  kind: 'infra',
  highlights: [
    'The calculations behind Billed, Owed, a job’s profit and a customer’s lifetime value now live where both the app and a server can use them, so a developer’s tools will report the same numbers the screens show. Nothing on any screen changes.',
  ],
}

export default note
