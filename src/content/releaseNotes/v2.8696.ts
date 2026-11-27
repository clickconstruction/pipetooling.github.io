import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8696',
  date: '2026-11-27',
  title: 'The app’s code check says how much memory it used, and warns well before it runs out',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. Before each update goes out, a check reads the app’s code in three parts. The memory it needs grows as the app grows, and until now it gave no sign before it ran out.',
    'Each part now ends with one line: how long it took, how much memory it held and how much it was allowed.',
    'When a part holds four fifths of what it is allowed, the check says so on the change that ran it. That is about three weeks of warning at the pace the app grows, and the check still gives its answer.',
  ],
}

export default note
