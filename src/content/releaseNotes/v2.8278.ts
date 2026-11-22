import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8278',
  date: '2026-11-21',
  title: 'Escape closes Write down their word and New task',
  kind: 'fix',
  highlights: [
    'Escape now closes Write down their word, the same as Cancel. Nothing is saved.',
    'Escape now closes New task, the same as the × at its top. A task that was typed and not sent is gone, as with the ×.',
    'When a list or a sheet is open over either window, Escape shuts that first. The next Escape closes the window.',
    'A window under either one stays open. One press of Escape closes one window.',
  ],
}

export default note
