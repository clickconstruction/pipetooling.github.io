import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8499',
  date: '2026-11-24',
  title: 'An update never reloads the app over words you typed',
  kind: 'fix',
  highlights: [
    'The app updates itself at a quiet moment. A message, a note or a report you typed and have not sent now holds that update, however long the tab sits.',
    'Before, words typed in a box and then left could be lost when the tab sat idle and the app updated under them.',
    'While your words are on the page the update waits, and the pill offers Reload for when you are ready. Send or clear your words and the app updates at the next quiet moment.',
    'Reload on the pill is still your own press. It reloads at once, so send or clear your words first.',
  ],
}

export default note
