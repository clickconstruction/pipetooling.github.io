import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7202',
  date: '2026-11-13',
  title: 'Paint a map: the groundwork',
  kind: 'infra',
  highlights: [
    'The app can now hold a painted map: lines somebody walked, drove or drew by hand, and named places with a word and a photo, on a job or a development. Nothing on screen uses it yet.',
    'A saved line is only a shape. It keeps no time along it, so it cannot say how fast anyone walked or how long they stood.',
    'This is the first step of several. The next ones add drawing a map by hand, walking one, and sharing it by a link.',
  ],
}

export default note
