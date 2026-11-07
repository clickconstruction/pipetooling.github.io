import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6646',
  date: '2026-11-07',
  title: 'Every project leaves award with an hours baseline, frozen, with its source named',
  kind: 'feature',
  highlights: [
    'New Job on a project shows Hours baseline at award: the bid’s Labor rows when they are usable, else the labor book’s assumed hours from similar projects, else a figure you type with your name on it. The first usable source is picked for you, a dead one says what would make it usable, and one line names what Create Job will freeze.',
    'The Costs tab’s baseline strip now reads four ways: ◆ from the bid, ≈ assumed from the book (grey and dashed, a guess read as one), ✎ typed, or amber with no baseline. The frozen award never moves; Refresh from bid writes the bid’s newer figures beside it and the strip still says what the award froze.',
    'A line that carries the bid’s price now carries the bid’s labor and materials shares too, so the Bill tab’s quiet line reads ◆ workbench on it. Line budgets and the Where we are card follow the job’s kind, so any project carries them, not only one with a stage In order.',
    'The Needs You card counts the projects working with no hours baseline, the ones made before this shipped. Quickfill’s Fill them in walks them one press each: take the bid’s estimate or freeze the book’s hours, with Undo.',
  ],
}

export default note
