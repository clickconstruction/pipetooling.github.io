import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7700',
  date: '2026-11-17',
  title: 'Trips: the ground for starting a trip from the phone',
  kind: 'infra',
  highlights: [
    'The groundwork for the crew to start a trip from the phone, join one, mark a day and end one. No screen changes yet.',
    'A crew member can only act on a trip of a job they are working, only on their own days, and only for today.',
    'The office still changes or deletes any trip. A trip still changes no clock row, no bill and no cost.',
  ],
}

export default note
