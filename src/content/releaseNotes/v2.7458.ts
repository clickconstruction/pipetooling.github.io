import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7458',
  date: '2026-11-16',
  title: 'Plans: the dev seat can change the Drive link of a set already saved',
  kind: 'feature',
  highlights: [
    'The dev seat can now move a saved set of drawings to a new Drive link, for a set whose link points at a file we do not own. The set stays the same set: the sets that replace it, the papers that go with it and the part that builds from it are untouched.',
    'The plan reads back the set, the link before and after, and whether the part builds from it. When it does, it names each job whose Open plans link follows.',
    'After the write the seat reads the set and those jobs again, and says whether each job opened the new link.',
    'A paper, a set that is not there and the link the set already has are refused in words.',
  ],
}

export default note
