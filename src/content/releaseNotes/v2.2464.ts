import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2464',
  date: '2026-08-28',
  title: 'Backing out of Bill Customer no longer leaves a draft behind',
  kind: 'fix',
  highlights: [
    'Opening Bill Customer on a Ready-to-Bill job prepares a draft bill for the whole remainder behind the scenes. Closing the window without sending anything used to leave that draft sitting in the job\'s invoice list — a full-amount "auto" draft nobody asked for, which made stage-by-stage billing confusing.',
    'Now, if the draft only came into existence because you opened the window, closing without billing removes it again. The job is left exactly as you found it.',
    'Anything you actually did keeps the draft: sending or starting a Stripe bill, recording an outside bill, setting who it bills to, or recording a payment against it.',
  ],
}

export default note
