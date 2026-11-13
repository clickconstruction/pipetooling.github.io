import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7182',
  date: '2026-11-13',
  title: 'Sign-in opens the page you asked for',
  kind: 'fix',
  highlights: [
    'A phone that was not signed in scanned the Scan to record code on a lien help sheet, signed in and landed on the Dashboard. It now lands on the place the code named: the job’s affidavit tab, or the Lien desk’s Affidavits list.',
    'The same holds for any link into the app: a job, a guide, a page a teammate sent. Sign in, and that page opens.',
    'It works with a password and with the emailed one-time link, which may open in another tab or another browser.',
    'Signing out and back in still lands on your usual first page. Only a page on this site is ever kept, so a link cannot use the sign-in to send anyone elsewhere.',
  ],
}

export default note
