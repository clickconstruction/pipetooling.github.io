import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6137',
  date: '2026-10-30',
  title: 'What everyone sees reads the words in drawings and charts',
  kind: 'feature',
  highlights: [
    'Settings → What everyone sees now measures the words of a drawing or a chart against the shapes drawn under them, so a training figure’s label on a tint or a chart’s axis words is held to 3:1 like any other text. Before, it read only the page’s own text, and it called the training figures clean while some of their words read under 3:1 in dark.',
    'A word that a line or a shape runs across is reported apart, as 1 text overlapped, and is never measured against the line itself.',
    'A lone character, a 0 or a ✓, is measured too. Before, text of one character was skipped.',
  ],
  roles: ['dev'],
}

export default note
