import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7286',
  date: '2026-11-14',
  title: 'Receipt texts carry the short link',
  kind: 'feature',
  highlights: [
    'A receipt link now reads my.clickplumbing.com/r/… instead of the app’s own address, so the text is shorter and cheaper.',
    'The short address forwards to the same page, with the code read either way it is typed.',
    'Copy the receipt link on the Team queue copies the short address too.',
  ],
}

export default note
