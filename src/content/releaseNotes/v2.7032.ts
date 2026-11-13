import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7032',
  date: '2026-11-12',
  title: 'My email: a tag says what it did to Follow up, with one press to say otherwise',
  kind: 'feature',
  highlights: [
    'After you tag a conversation, the green bar says what happened. Old mail was filed for the record, or the conversation is on Follow up.',
    'One press says otherwise: Put on Follow up for old mail that does need an answer, or No reply needed for a live one.',
    'There is no extra tick before a tag. The app decides by the age of the mail, and you overrule it after.',
    'A developer filing a batch of old conversations can file every mail for the record, so nothing lands in New.',
  ],
}

export default note
