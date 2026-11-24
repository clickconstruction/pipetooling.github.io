import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8471',
  date: '2026-11-24',
  title: 'The app never reloads itself over words you typed',
  kind: 'fix',
  highlights: [
    'A message, a note or a report you typed and have not sent now holds every reload the app starts by itself. It stays on the screen until you send it or clear it.',
    'When a window could not open for lack of a signal, the next press used to reload the app, and a third press opened the window. Now the app mends the page by itself once the signal is back, so the next press opens it.',
    'It mends the page only at a quiet moment: nothing typed, no window open, no cursor in a field and nothing saving.',
    'If you press while your words are still on the page, the amber line says so: send or clear them, then press again.',
  ],
}

export default note
