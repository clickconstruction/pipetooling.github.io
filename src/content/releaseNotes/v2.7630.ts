import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7630',
  date: '2026-11-17',
  title: 'Box labels: a retired box’s label names the box when you are signed in',
  kind: 'fix',
  highlights: [
    'Signed in, a label from a retired box on one of your jobs now names the box and the day it left. Before, it said the code did not open a box.',
    'The Scan a label page now names itself on the browser tab. Before, the tab read ClickTooling.',
    'A box’s page no longer leaves its name on the tab after you sign in.',
  ],
}

export default note
