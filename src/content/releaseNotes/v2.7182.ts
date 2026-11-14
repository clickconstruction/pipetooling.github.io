import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7182',
  date: '2026-11-13',
  title: 'Sign-in opens the page you asked for',
  kind: 'fix',
  highlights: [
    'A phone that was not signed in scanned a code, signed in and landed on the Dashboard. It now lands where the code points. That holds for the lien help sheets, a machine’s label and a box label’s Sign in press.',
    'The same holds for any link into the app: a job, a guide, a page a teammate sent. Sign in, and that page opens.',
    'It works with a password and with the emailed one-time link, which may open in another tab or another browser. A phone whose sign-in ran out long ago is treated the same.',
    'The app keeps the page you asked for one hour. Signing out and back in still lands on your usual first page. Only a page on this site is ever kept, so a link cannot use the sign-in to send anyone elsewhere.',
  ],
}

export default note
