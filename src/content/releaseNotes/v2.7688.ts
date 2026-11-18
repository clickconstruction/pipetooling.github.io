import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7688',
  date: '2026-11-17',
  title: 'Lien mail receipts: add a photo or a PDF, and it is kept the moment you add it',
  kind: 'feature',
  highlights: [
    'The receipt press now reads Add the receipt on every lien screen. It takes a photo or a PDF, so a receipt scanned at the office goes up as it is.',
    'On a phone the press asks first: Take a photo, or Choose a photo or a PDF. Every press there is a thumb tall.',
    'In Filed liens: copies to mail, each receipt and number is kept on its lien the moment you add it. Closing the window before Record loses nothing. Record still sets the day mailed.',
    'A saved receipt shows Open, Replace and Take off. Take off asks first, and the file stays in the job’s Drive folder.',
  ],
}

export default note
