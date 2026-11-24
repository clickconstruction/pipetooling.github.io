import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8489',
  date: '2026-11-24',
  title: 'The push check no longer says the deploy holds when it does not',
  kind: 'fix',
  highlights: [
    'A pull request whose database change only replaces functions the app already calls is now told that no deploy waits for its push.',
    'Before, the check ended with the deploy holds until the push on every such pull request. One was kept out of the merge queue on those words.',
    'A pull request whose app calls something only its database change creates still reads as before. That deploy does hold.',
  ],
  roles: ['dev'],
}

export default note
