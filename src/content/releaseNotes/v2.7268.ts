import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7268',
  date: '2026-11-14',
  title: 'Lien affidavits: the batch presses take what the find shows',
  kind: 'feature',
  highlights: [
    'On the Lien desk’s Affidavits list, type in the find box and Print for notarization and Send for approval take only the rows the find shows. Before, the find narrowed the list on screen while each press still took every paper in its pile.',
    'The press says so: Print 3 shown for notarization, Send 2 shown for approval. A line under it counts the ready papers the find hides, and says to clear the find to take them too.',
    'With nothing typed, both presses take every paper as before. A paper the find hides is not printed and is not listed as held on the help sheet.',
  ],
}

export default note
