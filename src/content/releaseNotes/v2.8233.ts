import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8233',
  date: '2026-11-21',
  title: 'State roll: our own plumbing licenses, checked against the state',
  kind: 'feature',
  highlights: [
    'Prospects → State roll has a new view, Our own. It lays each plumbing license we hold beside what the state’s roll says of the same number.',
    'A card says how the license reads: it matches, the state has a later date, it lapses soon, it has lapsed, or the state does not list the number.',
    'Use the state’s date saves the state’s date on our license in one press. You can also press our date and type a day.',
    'The view is for the people who can open People → Licenses. Nobody is contacted from it.',
  ],
}

export default note
