import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5999',
  date: '2026-10-27',
  title: 'Two punch-list cards on one number fail the build',
  kind: 'infra',
  highlights: [
    'A card that reuses a number another live card carries is an error in the to-do check, never a warning, so the second of two colliding PRs cannot land until it is renumbered.',
    'The test now pins the 2026-10-27 shape: two cards that both took the printed number, with the way out named as the next number past what every other branch holds.',
  ],
}

export default note
