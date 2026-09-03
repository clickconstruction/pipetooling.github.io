import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2686',
  date: '2026-09-03',
  title: 'Review costs sub-labor sheets and office hours the way Jobs and Overhead do',
  kind: 'fix',
  highlights: [
    'Sub-labor sheets on People → Review are now costed exactly like the Jobs page: per-line rate overrides and direct dollar lines count, so a job’s lifetime labor — and everyone’s revenue share on it — matches between the two pages.',
    'A person’s overhead labor (office and bid hours) is priced at their office rate when they have one, the same wage the Overhead tab’s pool uses; salaried people and single-rate people are unchanged.',
    'The Overhead labor drilldown and the math drawer say which rate was used.',
  ],
}

export default note
