import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5406',
  date: '2026-10-12',
  title: 'Messages: the rules behind reading a voicemail, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The first piece of reading voicemails on the company number: the rules, with no screen yet.',
    'A voicemail’s line will show what the caller said, from the phone service’s transcript, with its summary on the hover and its length.',
    'A day said in the voicemail becomes a chip such as Thu Oct 8, after 2 PM, with Keep the day and Another day.',
    'Keep the day saves it where any day heard is saved, and a voicemail puts the person on Needs a reply as a text does.',
  ],
}

export default note
