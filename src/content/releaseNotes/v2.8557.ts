import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8557',
  date: '2026-11-24',
  title: 'Word to every trade: a send that fails says the mail service’s reason',
  kind: 'fix',
  highlights: [
    'When the mail service refuses a word to a trade, the window now shows what the service said.',
    'Before, it read The email did not go out. Try again in a minute. whatever the cause.',
    'The company stays in the window with that reason, as before. Nothing else about the send changes.',
  ],
}

export default note
