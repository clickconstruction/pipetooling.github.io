import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8710',
  date: '2026-11-27',
  title: 'A development’s page: the proof of who signed, to print for the client',
  kind: 'feature',
  highlights: [
    'Under Papers for this site, The proof counts the companies that signed a paper for the site and the ones still asked.',
    'Make the packet opens the list as it prints: each company, who signed and the day, then each company asked and not yet signed.',
    'While secrecy is on for the site the packet counts our own people who signed. Workers are counted, not named.',
    'Print prints the packet alone, or saves it as a PDF. The signed copies are not attached yet.',
  ],
}

export default note
