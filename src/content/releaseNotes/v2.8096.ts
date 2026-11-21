import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8096',
  date: '2026-11-20',
  title: 'Document builder: a send that went but was not recorded says so',
  kind: 'fix',
  highlights: [
    'When a sheet’s email goes out but its record does not save, the page now says the email went and not to send it again.',
    'It used to say Something went wrong, try again, and trying again sent the trade a second email.',
    'A send that did not go now names the reason the mail service gave.',
  ],
}

export default note
