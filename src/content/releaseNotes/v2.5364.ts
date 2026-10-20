import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5364',
  date: '2026-10-12',
  title: 'Messages: a person’s flow sits above their thread on a phone',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, the flow’s rail is a row above the messages instead of a strip beside them, so the messages keep the whole width.',
    'Swipe the row to see every step. The arrow at its end opens the whole flow.',
    'A step’s card opens from the bottom and stays above the keyboard while you type a note.',
  ],
}

export default note
