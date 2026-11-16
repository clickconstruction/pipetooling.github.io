import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7454',
  date: '2026-11-16',
  title: 'Painted maps: a thrown-away map’s photos can be cleaned up',
  kind: 'fix',
  highlights: [
    'Throwing a painted map away left its places’ photos stored with nothing pointing at them, and nobody signed in could reach them to remove them.',
    'Now whoever added a photo, and the office, can still remove it after its map is gone. Nobody else can see it.',
    'This is the rule only. The app removing the photos by itself when a map is thrown away comes next.',
  ],
}

export default note
