import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4080',
  date: '2026-09-28',
  title: 'Jobs → Stages: links that open a window on the board are handled in one place',
  kind: 'fix',
  highlights: [
    'Behind the scenes: the links from the Dashboard and the emails that open something on the Stages board (follow-ups, GC Review, the round, a notice, the Lien desk, call mode, the forecast, Ready to Bill) are now handled by one piece instead of eight separate ones inside the page.',
    'Nothing changes on screen: each link still opens its window once and then drops out of the address bar, so a refresh or Back does not reopen it.',
  ],
}

export default note
