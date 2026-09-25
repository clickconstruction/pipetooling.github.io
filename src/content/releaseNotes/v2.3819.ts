import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3819',
  date: '2026-09-25',
  title: 'Put a GC on notice: the GC’s jobs by stage, and the door to mark each one right',
  kind: 'feature',
  highlights: [
    'The run window opens with a new band above the steps, “The jobs, by stage”: every job with unpaid work under the GC, grouped by the stage on record, each with its line items, the Pipeline’s progress-and-payment bar, and Job total · Billed · Paid.',
    'One chip per job says what looks wrong, in the Pipeline’s own words — “Waiting, but 80% done and a bill out”, “set % done” (red when a bill is out), “$13,860 done, not billed”, “quiet 122 d” — and the group heads count them.',
    'Every chip is a door: it opens the job window over the run on the field that fixes it — the status stepper, the % done field, the bills — ringed for a moment. A row opens the job; a line or the bar opens its bill at ① Line Items. ✕ brings the run back where you left it, re-read.',
    'Order by stage, biggest open first, or by property; fold the band with Hide the jobs. Both are remembered on this device.',
  ],
}

export default note
