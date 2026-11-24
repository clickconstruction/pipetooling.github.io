import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8499',
  date: '2026-11-24',
  title: 'An update never reloads the app over words you typed',
  kind: 'fix',
  highlights: [
    'The app updates itself at a quiet moment. A message, a note or a report you typed and have not sent now holds that update, however long the tab sits.',
    'Before, words typed in a box and then left could be lost when the tab sat idle and the app updated under them.',
    'Reload on the update pill now warns first when the page holds words you typed. It takes you to each place you typed and rings it in orange for a second.',
    'Then the pill offers Reload anyway and Not now. Not now keeps your words, and the app updates at the next quiet moment after you send or clear them.',
  ],
}

export default note
