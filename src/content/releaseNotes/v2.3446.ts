import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3446',
  date: '2026-09-14',
  title: 'Pipeline: the Progress & payment cell stays in its column',
  kind: 'fix',
  highlights: [
    'On Ready to Bill, Billed Awaiting Payment and Collections rows the new bar and its sentence were spilling to the right under the Bill Customer / Mark Paid buttons, and the dollar figures landed under the wrong column. The cell now keeps to its own column on every section.',
    'The sentence under the bar wraps to two lines before it clips, so a narrow desktop column no longer cuts it at “Top Out · Tristen on site Sat · 4…”.',
  ],
}

export default note
