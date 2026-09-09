import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3198',
  date: '2026-09-09',
  title: 'Stages on the Pipeline row',
  kind: 'feature',
  highlights: [
    'On a job split into stages, the Pipeline’s Progress & payment cell now shows the stages: chips (① Rough → ② Top Out 60% → ③ Trim) and one bar whose segments are the stages, sized by their share of the job.',
    'A segment’s fill is how far the crew is; its thin bottom edge is what happened to that stage’s draw — green paid, blue billed, amber ready to bill, gray nothing yet. A caption spells it out: "Stage 2 of 3 · Top Out 60% · draw 1 paid".',
    'Long stage names shorten by rule (Rough In → Rough, Trim Set → Trim) and collapse to their numbers when the cell is narrow; the full name is in the tooltip. Jobs without stages keep the money bar they had.',
  ],
}

export default note
