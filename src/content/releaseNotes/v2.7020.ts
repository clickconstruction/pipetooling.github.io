import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7020',
  date: '2026-11-12',
  title: 'Messages: a conversation a developer tagged for you says so on the thread',
  kind: 'fix',
  highlights: [
    'A tagged email conversation shows a grey line on the thread that names who tagged it. A developer can tag a conversation from a teammate’s mail for them. The line used to name the teammate, as if they had pressed it.',
    'The line now names the developer and ends “through the dev seat”. A tag you press yourself in My email reads as it always has.',
    'You can untag a conversation a developer tagged for you. Every line the tag put on the job comes off with it.',
    'Tags made before today keep their old words until they are corrected by hand.',
  ],
}

export default note
