import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3421',
  date: '2026-09-14',
  title: 'Pipeline: “Set stages” on jobs whose lines could be stages',
  kind: 'feature',
  highlights: [
    'A job with two or more priced line items that the board could not read as stages (a Beginning and a Final, a Phase A and a Phase B) now shows a small “Set stages” link under its bar on Jobs → Pipeline.',
    'It opens the job’s Bill tab at ① Line Items, where Order / Any / — on each line says which lines wait their turn — and the row draws the stages from then on.',
    'Jobs already drawn as stages, single-line jobs, jobs with no bid value and paid jobs do not show it.',
  ],
}

export default note
