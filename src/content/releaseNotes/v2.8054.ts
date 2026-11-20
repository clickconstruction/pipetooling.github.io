import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8054',
  date: '2026-11-20',
  title: 'The app’s first download is lighter again: the permit rules load when a list asks for them',
  kind: 'infra',
  highlights: [
    'The first download of the app is about 88 kB smaller.',
    'The rules behind the city’s permits had moved into it with Before we start’s permit bullets. They load again only when a screen needs them.',
    'A bullet that reads the city’s permits reads the same as before. A seat that cannot read permits is told so without downloading them.',
  ],
}

export default note
