import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6048',
  date: '2026-10-29',
  title: 'The Plans card shows the question it asked, and the answer when it comes',
  kind: 'feature',
  highlights: [
    'When you ask the estimators about the pieces on an older plan set from the Plans card, the card keeps the question in view: Asked the estimators Oct 29, waiting 2 days, with a door to Questions. The ask button steps aside while the question waits.',
    'When the estimators answer, the card reads the answer under the chips, with the day it came, and the ask button comes back for the next round.',
  ],
}

export default note
