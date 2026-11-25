import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8599',
  date: '2026-11-25',
  title: 'Hard Reload says Reloading… from the press',
  kind: 'fix',
  highlights: [
    'After Hard Reload in the gear menu, the page could stand for three seconds as it was, with nothing to say a reload was on its way.',
    'It now reads Reloading… over the whole page from the press until it leaves, and takes no other press in that time.',
    'When the page holds words you typed, it still asks first. The cover comes only once the reload starts.',
  ],
}

export default note
