import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2876',
  date: '2026-09-05',
  title: 'Bill Customer and New estimate: nothing is written until you commit',
  kind: 'fix',
  highlights: [
    'Opening Bill Customer on a job no longer creates, resizes or deletes the automatic remainder draft. The modal shows the amount it will bill; the draft row is written the moment you press Send (Stripe), Save (HouseCall Pro) or Send invoice (Physical). Cancel leaves the job exactly as you found it.',
    'If the remainder moved while the modal was open — a payment landed, a partial was carved off — the send stops and shows the new amount instead of billing it silently.',
    'New estimate and New change order (and the + Estimate on a Projects card) still open a fresh draft, but leave it without typing and it removes itself. Empty drafts stop piling up in the Pipeline.',
    'Until a bill row exists, the Stripe tab shows the draft line the customer will see; Stripe\'s exact layout appears once the bill exists.',
  ],
}

export default note
