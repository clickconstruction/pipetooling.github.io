import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6827',
  date: '2026-11-10',
  title: 'The ground for one place for work paid in kind',
  kind: 'infra',
  highlights: [
    'Nothing new shows on a screen yet. This is the first of four steps toward one place for work a customer pays with something other than money.',
    'The app can now keep the deal itself: who pays in kind, with what, and which jobs it pays.',
    'Each thing given will be one line with an amount, a date and a memo. A line counts as overhead unless it is put on a job.',
    'One line pays the oldest open bills in order, in one step. A credit that spans two bills no longer takes two windows.',
  ],
}

export default note
