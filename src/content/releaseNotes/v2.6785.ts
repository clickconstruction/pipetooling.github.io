import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6785',
  date: '2026-11-09',
  title: 'Research: the Plumber column names a plumber only when the permit does',
  kind: 'fix',
  highlights: [
    'On a commercial job the plumbing permit is often pulled under the same name as the building permit, the GC or the expediter. The ledger drew that name as the plumber and counted it under Who wins what. Now a plumber is named only when the plumbing permit names someone else; otherwise the row reads on file, no plumber named, with the day.',
    'Who wins what counts the plumbers named on a permit, not the applicants who pulled their own.',
  ],
}

export default note
