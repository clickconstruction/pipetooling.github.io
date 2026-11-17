import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7624',
  date: '2026-11-17',
  title: 'Estimates: the options row is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the row of option cards on a draft estimate moved out of the big estimate page into its own file.',
    'Nothing changes on screen. ＋ Option, the option’s name and pitch, Offered as, ★ Recommended, ✓ Start ticked and Remove option work as before.',
    'The row has its own tests now, and the page’s test checks that two options save with the starred one’s total.',
  ],
}

export default note
