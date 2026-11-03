import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6422',
  date: '2026-11-02',
  title: "The dev seat reads a person's HR file whole, as People → HR draws it",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "A dev's agent asks get_person_file for a person and gets the Timeline's lines in their lanes by month, the fact chips, the evidence records with where they stand in Drive, and the summary and narrative.",
    'It is the same kernel the HR tab draws from, over the same sources, read as you under the same access rules: what you cannot read is named, and the rest still shows.',
    'Find the person by the roster id, the login, or a name that matches one person. Narrow by lane, source or a day, or leave the long narrative out.',
  ],
}

export default note
