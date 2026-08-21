import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1961',
  date: '2026-08-21',
  title: 'Data-gap alerts join the money card',
  kind: 'feature',
  highlights: [
    'On the Pipeline New view, the "No customer", "No customer pictures", and "No email" alerts now dock as a quiet Fix-ups strip at the bottom of Today\'s Money Opportunities — one card holds everything that needs attention.',
    'Each chip opens the same job list as before, only renders when there\'s something to fix, and the whole strip disappears when the data is clean.',
    'Fixed: a lone "No email" alert never showed on the classic strip row; now it does.',
  ],
}

export default note
