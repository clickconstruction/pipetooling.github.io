import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2843',
  date: '2026-09-05',
  title: '"No connection" only when the connection actually failed',
  kind: 'fix',
  highlights: [
    'Most database errors used to be reported as "No connection — check your signal" and retried four times, even on perfect wifi. Now that message appears only when the app truly could not reach the server.',
    'A refused read says so: "You don\'t have access to this …". A broken or stale link says "This link points to something that doesn\'t exist any more." Neither is retried, so the page settles at once instead of spinning.',
    'Other server errors read "Couldn\'t load <thing>: <reason>" with the thing named in plain words instead of code names.',
    'Real no-signal failures still show the offline message and still retry.',
  ],
}

export default note
