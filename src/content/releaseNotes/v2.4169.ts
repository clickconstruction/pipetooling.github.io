import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4169',
  date: '2026-09-29',
  title: 'Submittals: a step you have not reached shows what it is for, not its buttons',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On a new submittal, steps 4 to 8 used to sit open with live buttons — Build package, Share and New revision could be pressed before the rows were done. A step you have not reached now folds to its one-line sentence; the ? beside it walks you through it.',
    'Open a later step early and its button is held, with the reason under it: “Build package turns on when every row has its reason and its cut sheet.” “Share turns on once the package is built.” “New revision turns on once the package is built.”',
    'A step with nothing in it yet no longer draws an empty box. The Package pill reads done as soon as the package is built, whatever the rows still owe.',
  ],
}

export default note
