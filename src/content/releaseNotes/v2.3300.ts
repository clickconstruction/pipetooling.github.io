import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3300',
  date: '2026-09-11',
  title: 'Job Summary and the Pipeline: every Burn figure says what it stands on',
  kind: 'feature',
  highlights: [
    'On Job Summary the Burn cell wears a glyph — ◆ when the job burns against its linked bid’s estimate, ✎ against a typed budget — and hover says so; an unmarked cell is still the assumed price × (1 − target). A new Budget chip (all · ◆ from bid · ✎ typed · ≈ assumed) filters the table, and “≈ assumed” is your linking backlog.',
    'A chip under the tiles counts the open jobs burning against an assumption; open a job’s Costs tab to link its bid.',
    'The Pipeline’s burning-jobs card measures margin at risk against each job’s own footing, marks the worst three with their glyph, and says how many of them are on an assumed budget.',
  ],
}

export default note
