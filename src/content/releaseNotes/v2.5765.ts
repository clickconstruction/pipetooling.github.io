import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5765',
  date: '2026-10-23',
  title: 'Pipeline: scrolling over the % done box no longer changes the number',
  kind: 'fix',
  highlights: [
    'On Jobs → Pipeline, the % done box used to count up or down when you scrolled the page with the pointer over it and the box still focused. It was the browser doing it, not you.',
    'Now a scroll over the box lets go of it and scrolls the page. The number stays what you typed; nothing saves until you leave the box the usual way.',
  ],
}

export default note
