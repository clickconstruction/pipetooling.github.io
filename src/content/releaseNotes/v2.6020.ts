import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6020',
  date: '2026-10-28',
  title: 'GC mode: the schedule builder’s rows, a template that keeps its phases and rows and a new version on each save',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A schedule template can now be kept as phases and rows with no dates, with its kind and whether its days count Monday to Friday. A template saved before keeps its lines and still reads.',
    'A save makes a new version of a template: the one it replaces keeps its rows for the jobs drawn from it and leaves the pick, and the name stays with the newest. A template made from nothing on the Templates page needs no job it came from.',
    'A first draft now keeps the phase each bar and date to meet was drawn in, and the phases in order, so the job can list its schedule by phase.',
    'Nothing on screen yet: the Templates page, the paste, the job’s side and the trade portal follow.',
  ],
}

export default note
