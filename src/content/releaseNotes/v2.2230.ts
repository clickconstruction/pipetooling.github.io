import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2230',
  date: '2026-08-24',
  title: 'HR files: readable docs with sections and provenance',
  kind: 'feature',
  highlights: [
    'HR summaries and narratives now render with real headings, bold, lists, and tables instead of a wall of plain text.',
    'Long narratives get a jump-to-section list built from their headings.',
    'Each doc shows who maintains it and exactly which entries it covers, so the freshness dots reflect what the writer actually folded in.',
  ],
}

export default note
