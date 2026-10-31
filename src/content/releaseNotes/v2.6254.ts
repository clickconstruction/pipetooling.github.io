import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6254',
  date: '2026-10-31',
  title: 'A pull request that must be pushed right after its merge now says so',
  kind: 'fix',
  highlights: [
    'When an app change calls what only its own database change creates, its pull request now carries the label push right after the merge. Whoever arms it sees that the push must follow right away.',
    'The label never appeared before. Its description ran past GitHub’s 100-character limit, so GitHub refused it on every run.',
    'When the label cannot be added, the check now gives GitHub’s reason instead of the command it ran.',
  ],
  roles: ['dev'],
}

export default note
