import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7735',
  date: '2026-11-18',
  title: 'Edit Job: the highlight rings are their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a link can open a job on one spot and ring it for a moment: the line items, the payments, the status, the percent done, the customer, the pictures link.',
    'The code that scrolls there, rings the spot and lets the ring fade moved out of the big Job form into its own file, with its own tests.',
    'Nothing changes on screen. The form was compared before and after in 39 snapshots over time, and each one came out the same.',
  ],
}

export default note
