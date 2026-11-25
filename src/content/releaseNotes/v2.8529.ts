import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8529',
  date: '2026-11-24',
  title: 'Jobs → Pipeline: Addresses that look alike, a list of places that may be written two ways',
  kind: 'feature',
  highlights: [
    'The Pipeline’s tools menu has a new item under Combine / Separate…: Addresses that look alike…. Its count also shows on the tools button until every pair is answered.',
    'It pairs addresses on file in three groups: written alike at the same spot on the map, written alike where the map says apart, and different words at the same spot.',
    'Each pair takes one answer, Same place or Not the same. The answer is kept with who gave it, and Undo asks the pair again. No job’s address changes.',
    'A fourth tab lists the addresses with no street number, which words alone cannot match.',
  ],
}

export default note
