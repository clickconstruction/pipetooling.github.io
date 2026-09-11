import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3347',
  date: '2026-09-11',
  title: 'The Legal button opens on a fresh page',
  kind: 'fix',
  highlights: [
    'Jobs → Pipeline: the ⚖ Legal button beside Collections was greyed out until you expanded the Collections tier, because it waited on rows the tier only loads when opened. It now follows the count in the tier\'s header and opens the desk straight away.',
    'The button sits on the Collections header row, where the Accounts Receivable button sits on the Billed row.',
  ],
}

export default note
