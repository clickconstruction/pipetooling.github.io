import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2475',
  date: '2026-08-29',
  title: 'Bid room signatures record correctly',
  kind: 'fix',
  highlights: [
    'Signing a proposal in the bid room failed at the last step with "Could not record the signature" — a database rule from before bid proposals existed was rejecting the signed record. Fixed; caught in live testing the day it shipped, before any GC hit it.',
  ],
}

export default note
