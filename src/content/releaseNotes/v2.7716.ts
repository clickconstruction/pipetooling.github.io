import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7716',
  date: '2026-11-17',
  title: 'Copy a letter: a paper tagged INTERNAL in its title is held back, and a copy that still says DRAFT warns',
  kind: 'fix',
  highlights: [
    'A heading that carries INTERNAL in capital letters anywhere now marks its section internal. Before, the word had to come first. A title tagged that way makes the whole paper internal, so the desk says there is no letter to copy.',
    'A copy can still say DRAFT or INTERNAL in capital letters, in a status line or a sentence. An amber line over the words now says so, and the copied message warns.',
    'Copy everything as text still takes the whole paper. The HR file\'s Copy the letter press follows the same rules.',
  ],
}

export default note
