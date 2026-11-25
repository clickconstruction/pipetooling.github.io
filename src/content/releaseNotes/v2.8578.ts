import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8578',
  date: '2026-11-25',
  title: 'Paint a map on an iPhone: the start sheet ends above Safari’s bar',
  kind: 'fix',
  highlights: [
    'On an iPhone in Safari, the Paint a map sheet now ends above Safari’s bar. Before, Start with a place sat behind the bar.',
    'When the sheet is taller than the screen, it scrolls, so both Draw it by hand and Start with a place can be reached.',
    'The Which job is it for? list does the same, and it also stays above the keyboard while you search.',
    'At a desk nothing moved.',
  ],
}

export default note
