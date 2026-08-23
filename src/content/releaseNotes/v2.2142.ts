import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2142',
  date: '2026-08-23',
  title: 'Edit Sub Labor gets the job search',
  kind: 'feature',
  highlights: [
    'Edit opens with the same Job field as New: the sheet\'s job with its address underneath, and "change" opens the job search (number, name, address, customer — with trade and stage). No more blank Job # box.',
    'Old sheets whose typed number matches no job read "No job with this number" in amber and keep their typed Address — tap "link" to attach one. Nothing re-links on its own, and moving a sheet never touches the crew.',
    'Tidier, same as New: a one-line summary under the title (contractor · total · due) replaces the requirements paragraph; the section is "Crew"; Delete sits alone on the left, away from Save.',
    'The job search is titled "Which job is this sub labor for?" instead of "Add job to schedule".',
  ],
}

export default note
