import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5606',
  date: '2026-10-17',
  title: 'Prospects: May we text? is asked on the call, and texts wait for the yes',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The texting chip on a prospect’s card is a press now: Not asked, Yes or No, saved as soon as you press it.',
    'Messages will not text a prospect who has not said yes. The send says who has not been asked, or who said no, and points at the card.',
  ],
}

export default note
