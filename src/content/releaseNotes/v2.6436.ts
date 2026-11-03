import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6436',
  date: '2026-11-03',
  title: 'Messages: a build no longer turns red for a reply-box check that already passed',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A behind-the-scenes check of the reply box read a customer’s bills and estimates after the check itself was over, and on a busy build server that could turn the whole build red with every check passing. The box now drops a read that lands after it is gone. Nothing changed in what the box shows.',
  ],
}

export default note
