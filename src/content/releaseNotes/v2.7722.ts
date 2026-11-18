import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7722',
  date: '2026-11-17',
  title: 'Edit Job: the Stripe memo read is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Job form asks Stripe for a sent bill\'s memo and footer when they are missing. That read moved out of the big Job form into its own file.',
    'The test for which bills still wait was written three times in the form. It is written once now, with its own tests.',
    'Nothing changes on screen.',
  ],
}

export default note
