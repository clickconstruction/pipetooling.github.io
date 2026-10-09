import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5097',
  date: '2026-10-09',
  title: 'Nine home-screen icons to pick from, for a dev',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The home-screen icon still looked rough under the iPhone’s glass. A page now shows nine choices side by side: the yellow tile, a dark tile with a yellow mark and a dark tile with a white mark, each with three weights of the gear.',
    'Each choice is shown as the file and under a drawn copy of the glass, on a light and a dark wallpaper. Open the page on an iPhone and the home-screen row matches the real size.',
    'Nothing in the app changes yet. The icon is remade from the letter picked.',
  ],
}

export default note
