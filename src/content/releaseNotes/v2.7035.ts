import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7035',
  date: '2026-11-12',
  title: 'My email: the app leaves no mark in your Gmail',
  kind: 'fix',
  highlights: [
    'Tagging a conversation used to put the label “Tagged in ClickTooling” on its mail in your Gmail. It no longer does. A tag copies the mail into the app and changes nothing in your mailbox.',
    'The label is being removed from every mailbox that has it. No mail is deleted, moved or read to do this, and every tagged conversation stays on its job.',
    'The Tagged list in My email now comes from what the app has saved. It shows every mail of a tagged conversation, including one you archived.',
    'Untag no longer touches Gmail either.',
  ],
}

export default note
