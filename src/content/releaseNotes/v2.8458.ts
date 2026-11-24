import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8458',
  date: '2026-11-24',
  title: 'Reload checks for a signal before it reloads',
  kind: 'fix',
  highlights: [
    'When a page could not load, pressing Reload with no signal emptied the app from the phone and left the browser’s own error page.',
    'Reload now checks for a signal first. With a signal the page reloads as before.',
    'With no signal nothing is reloaded. The page says “No signal, so nothing was reloaded. Press Reload when the signal is back.”',
    'The Reload press is taller, so a thumb can hit it on a phone.',
  ],
}

export default note
