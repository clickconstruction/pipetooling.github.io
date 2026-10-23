import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5768',
  date: '2026-10-23',
  title: 'Edit Job: scrolling over the % done box no longer changes the number',
  kind: 'fix',
  highlights: [
    'The % done box on Edit Job’s money card used to count up or down when you scrolled with the pointer over it and the box still focused, the same as the Pipeline box before v2.5765.',
    'Now a scroll over the box lets go of it and scrolls the form. The number stays what you typed; nothing saves until you leave the box the usual way.',
  ],
}

export default note
