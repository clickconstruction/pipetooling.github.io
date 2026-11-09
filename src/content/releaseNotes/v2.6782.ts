import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6782',
  date: '2026-11-09',
  title: 'Research: the permits San Antonio issues, on a ledger under Prospects',
  kind: 'feature',
  highlights: [
    'Prospects has a Research tab. It lists the building permits and project applications San Antonio has filed, newest first, with who pulled each one and whether a plumbing permit already names a plumber.',
    'Decide… on a row opens one sheet: Approach them, Look into it, Not for us or Already taken, each with a reason the next estimator reads. Approach them makes a GC lead on the GCs deck with the permit on it.',
    'The feed is pulled every morning before the office opens, and Pull now reads it again. The line under the filters says when, what is new since you last looked, and how many rows sit on each lens.',
    'Every estimator can open Research, with or without the Prospects flag; the calling deck stays behind the flag.',
  ],
}

export default note
