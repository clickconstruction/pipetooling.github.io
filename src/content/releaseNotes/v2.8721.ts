import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8721',
  date: '2026-11-27',
  title: 'Settings says what the labor burden factor is and where it reaches',
  kind: 'feature',
  highlights: [
    'The app multiplies a field wage by 1.20 wherever it prices a crew hour. No screen said what that number was.',
    'A developer now reads it in Settings → Data & recovery → Labor burden factor. It stands for depreciation on the tools and the truck a person uses.',
    'The block lists where it reaches: a bid’s crew rate and price, a job’s labor budget, the superintendents’ scoreboard and the team scores.',
    'It also lists where it does not: what a job has cost, Job Summary, Crew P&L, pay stubs and the overhead pool. The number itself is unchanged, and nothing on the screen changes it.',
  ],
}

export default note
