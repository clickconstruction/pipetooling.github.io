import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2510',
  date: '2026-08-30',
  title: 'Robot pipes now turn square corners, the way the architect drew them',
  kind: 'feature',
  highlights: [
    'Traced runs are orthogonalized — every diagonal shortcut becomes the L-path whose corner actually sits on the drawing\'s ink, and the gate refuses undeclared diagonals outright.',
    'The proof is in the fittings: sixteen phantom 45-ells collapsed to one real one, and the 90° elbows the architect actually drew appeared in their place.',
    'Genuinely diagonal runs are declared per-run, deliberately — the one true 45° tail on LIVSTE stays a 45.',
  ],
}

export default note
