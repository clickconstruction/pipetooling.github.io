import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7659',
  date: '2026-11-17',
  title: 'Papers before a job opens: the database now holds the lock for crew and subs',
  kind: 'infra',
  highlights: [
    'A helper, a sub, a superintendent or an estimator who owes a paper on a job can no longer read that job from the database. The prompt is no longer their only lock.',
    'That covers the job itself, its notes, photos, checklists, plans, materials on site, files and texts.',
    'The office and primaries keep their lists and totals. For them the prompt at the job is the lock.',
    'Nothing changes on any job that requires no paper.',
  ],
}

export default note
