import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8676',
  date: '2026-11-27',
  title: 'Agreements: a paper can print its site’s address for the signer to read',
  kind: 'feature',
  highlights: [
    'When a paper for an outside company names a site, the email window has a new box under it: Print the site’s address on the paper. It starts unticked.',
    'Unticked, the signer reads nothing about the site. Ticked, the signer reads a line, Site address, with the address above the paper before they sign.',
    'A signed paper’s PDF prints the same line above its words, and so does the copy the signer is emailed. A form’s PDF is the form itself and prints no address.',
    'The box cannot be ticked until the signing page is able to show an address, and it says so. Naming another site unticks it.',
  ],
}

export default note
