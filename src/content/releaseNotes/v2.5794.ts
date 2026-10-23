import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5794',
  date: '2026-10-23',
  title: 'Tell the customer: Preview shows the email and the text as the customer sees them',
  kind: 'feature',
  highlights: [
    'On the Tell the customer sheet, each What goes row has a Preview. It opens a window over the sheet, and the sheet stays open under it.',
    'The email preview is the message as it arrives, with From, To and Subject. The text preview is the words as they land on their phone, with a sample link where the real one will go.',
    'Nothing is sent from the preview. Back to the sheet, the × or Escape close it alone.',
  ],
}

export default note
