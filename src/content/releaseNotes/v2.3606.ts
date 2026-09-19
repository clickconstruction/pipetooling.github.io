import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3606',
  date: '2026-09-18',
  title: 'View as, part 1: Imitate lands on the page you were on and Exit brings you back; sample accounts, one per role',
  kind: 'feature',
  highlights: [
    'Imitate (People → Users, the person desk) now lands you on the page you were looking at, as that person — so "does an assistant see this button?" is one click. If their role cannot open the page, you land where the app sends them, which is the answer. Exit returns you to the page you left instead of the dashboard.',
    'Settings → Active accounts gains a Sample accounts heading: one hidden account per role (Sample assistant, Sample estimator, …) that a dev can imitate to see the app as a role without borrowing a real person. Create the missing samples makes them; their switches are set like anyone\'s.',
    'Sample accounts never appear on a roster, a picker or a notification — the same hiding digital twins get.',
  ],
}

export default note
