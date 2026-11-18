import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7622',
  date: '2026-11-17',
  title: 'Estimates: Customer experience is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Customer experience section of an estimate moved out of the big estimate page into its own files.',
    'Nothing changes on screen. The Email, Acceptance page and Thank you previews, and the boxes that change the customer copy on a draft, work as before.',
    'The rule for those boxes is tested now: a box cleared or typed back to the company’s wording saves nothing, and Hide company footer saves an empty footer.',
  ],
}

export default note
