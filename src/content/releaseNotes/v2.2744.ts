import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2744',
  date: '2026-09-04',
  title: 'File a signed contract by pasting its Google Doc link',
  kind: 'feature',
  highlights: [
    'The Contract modal’s top-right button is now File a signed contract: paste the Google Doc’s Share link, confirm who signed and when, and the job reads "✍ On file · Google Doc". Nothing is sent to the customer.',
    'A scan or photo is still possible, tucked behind "Have a scan or photo instead?" — the link is the way we file.',
    'Signed records show Open the signed Google Doc, and Share can copy or email that link.',
  ],
}

export default note
