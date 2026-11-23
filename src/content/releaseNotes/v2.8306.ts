import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8306',
  date: '2026-11-22',
  title: 'Customer links open with less to download, and say so when a page does not load',
  kind: 'fix',
  highlights: [
    'An estimate, a pay link, an account page and the other pages opened from a link now download about a third less before they draw. Nothing about how those pages read has changed.',
    'While such a page loads, the customer sees the page’s own background with Loading…. If it takes more than ten seconds the page says so and offers Try again.',
    'If a page cannot load, it says “This page did not load. Check your signal, then try again.” It no longer shows words meant for staff.',
    'A phone with no signal keeps what it has saved. The app no longer reloads into the browser’s error page while it is offline, and a public page loads by itself when the signal is back.',
  ],
}

export default note
