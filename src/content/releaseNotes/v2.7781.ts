import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7781',
  date: '2026-11-18',
  title: 'The header stays on one line on every phone',
  kind: 'fix',
  highlights: [
    'On a phone the top bar no longer breaks onto a second line. It stays one line at every width.',
    'When the line has no room, the wrench moves into the gear menu as its first row, Tell the dev. It opens the same box.',
    'On a smaller phone the people button moves under the gear too, as People, and then the customers button, as Customers.',
    'Where there is room, on a wide phone or a computer, nothing moves.',
  ],
}

export default note
