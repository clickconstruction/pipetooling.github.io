import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1959',
  date: '2026-08-20',
  title: 'Jump strip counts are right before you open anything',
  kind: 'fix',
  highlights: [
    'The Waiting → Working → Ready to Bill strip at the top of the Pipeline showed (0) for sections you hadn\'t opened yet. It now reads the same live numbers as the section headers, so it\'s accurate the moment the board loads.',
    'The "Today\'s money moves" queue is now titled "Today\'s Money Opportunities:".',
  ],
}

export default note
