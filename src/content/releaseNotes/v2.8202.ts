import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8202',
  date: '2026-11-21',
  title: 'State roll: the weekly read keeps our own team’s licenses, wherever they live',
  kind: 'infra',
  highlights: [
    'The weekly read of the state’s plumbing licenses now keeps the state’s record for each plumbing license on People → Licenses, and for each sub’s license on the roster, whatever county the person lives in.',
    'It reads the state’s apprentice list for our own apprentices alone. No other apprentice is kept.',
    'Nothing on screen changes yet. This is the ground for checking our own team’s licenses against the state.',
  ],
}

export default note
