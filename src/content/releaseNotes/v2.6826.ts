import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6826',
  date: '2026-11-09',
  title: 'The dev seat says a job needs its number before it bills it',
  kind: 'fix',
  highlights: [
    'A Stripe bill is numbered from the job’s HCP or Click number. When a job had neither, the seat’s bill plan read fine and the bill stopped at Stripe. Now the plan says so first and names the fix: give the job its number, then bill.',
    'Setting up a job from the seat also says whether it has a number a bill can use.',
  ],
}

export default note
