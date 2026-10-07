import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4660',
  date: '2026-10-06',
  title: 'Help: a warning when a guide sentence opens on "it" or "that"',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A pull request that changes a help guide now lists every sentence that opens on a pronoun pointing back, like "It shows…" or "That means…". The writer repeats the noun wherever the pronoun could mean more than one thing.',
    'It is a warning, never a failure, and it also notes a paragraph that opens two sentences on "So". The notes show on the pull request beside the line.',
  ],
}

export default note
