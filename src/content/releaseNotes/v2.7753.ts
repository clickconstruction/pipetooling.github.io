import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7753',
  date: '2026-11-18',
  title: 'Three trims: empty checklists, your own reports, and supply house chips',
  kind: 'fix',
  highlights: [
    'Job Mode no longer lists stage checklists for a job whose stages have no questions. The job window still lists them, so the first check keeps its door.',
    'Recent Reports no longer counts a report you wrote yourself as new, and no longer opens itself for it.',
    'On My Schedule, supply houses that all read none yet fold to one line, none yet at 3 houses. A tap opens each house.',
  ],
}

export default note
