import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8608',
  date: '2026-11-25',
  title: 'Word to every trade: one bad address no longer stops the word to a whole company',
  kind: 'fix',
  highlights: [
    'When the mail service refuses one person’s address, the other people at the company still get the word, each in an email of their own.',
    'The window names the person who was left out, with the mail service’s reason, and counts the emails that went and the ones that did not.',
    'Mend the address and send the same words again. The window keeps your words, and they go only to the people who did not get them.',
    'This needs the mail function updated after the release. Until then a refused address stops the word to that company, as before.',
  ],
}

export default note
