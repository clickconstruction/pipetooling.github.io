import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8433',
  date: '2026-11-24',
  title: 'Document builder: the send button names who gets the email by their whole name',
  kind: 'fix',
  highlights: [
    'The blue button that sends to one trade or one GC now reads the contact’s whole name, like Send to Dana Whitlock.',
    'It read the first word alone, so a company’s own address or a contact named for a desk read as one word that named nobody.',
    'A contact with no name on the record still reads by its email address.',
  ],
}

export default note
