import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4396',
  date: '2026-10-02',
  title: 'Takeoffs: the old By Stage screens are gone for good',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Nothing changes in how you build a takeoff. The code behind the retired By Stage screens is removed.',
    'Fill from book now tells you what it did, in a short message at the bottom of the screen.',
    'On Labor, a bid with no parts on its takeoff now says "no materials yet". It used to say "materials from takeoff".',
    'The Takeoff book no longer shows a Stage for each assembly. You set stages with the 1 · 2 · 3 boxes on the takeoff.',
  ],
}

export default note
