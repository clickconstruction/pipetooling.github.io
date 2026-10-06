import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4704',
  date: '2026-10-06',
  title: 'Legal desk: open the law firm from its name',
  kind: 'feature',
  highlights: [
    'The firm\'s name in the Legal desk\'s header is now a button. It opens the firm\'s details in a window over the desk, so your place in the account list stays put.',
    'A dev edits the firm there, with the same form as Settings. Saving updates the desk at once: its name, the Click keeps figures and the release sheet.',
    'The window says what is on the firm now: its open accounts, the people on its email list, and whether its portal link is on.',
    'With no firm yet, the header and the release sheet offer Set up the firm. Settings now counts how many of your particulars for filing are filled in.',
  ],
}

export default note
