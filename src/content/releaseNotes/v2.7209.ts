import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7209',
  date: '2026-11-13',
  title: 'Lien desk: the print bar over the Affidavits list says less, and the held papers stand out',
  kind: 'feature',
  highlights: [
    'The bar opens on one line: how many affidavits are ready to print. Beside it an amber press says how many are held and not in this print. Press it to see only the held papers, each with what it is missing. Show every paper brings the list back.',
    'The three tick boxes are three chips under Print with: Help sheet, Notice record and Notice copies, which still says about how many pages it adds. They do what they did, and the app remembers them as before.',
    'The county is one line: Signed in, the box, County. An empty box says the notary writes it. The longer words are behind a small ? after the box, here and beside Print for notarization in a job\'s Lien window.',
    'Nothing on the affidavit, the help sheet or the notice record changed, and the press prints the same papers.',
  ],
}

export default note
