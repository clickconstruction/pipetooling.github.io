import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8466',
  date: '2026-11-24',
  title: 'Document builder: a send that went but was not recorded has its own answer',
  kind: 'fix',
  highlights: [
    'When an email goes but its record does not land, the page already says so and tells you not to send it again.',
    'The app’s server now says this in its own words, where the page used to work it out from the reason.',
    'Nothing changes on the screen. The words are the same before and after the server is updated.',
  ],
}

export default note
