import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5945',
  date: '2026-10-26',
  title: 'Empty lists name the next press in GC mode, Quickfill and the schedule',
  kind: 'feature',
  highlights: [
    'GC projects: each empty section of the Project Board says what fills it, and an empty Bidding to the customer offers New project. Change orders offer New change order, and a schedule, a message list or a thread hidden by its filters offers Show all or Clear the search.',
    'Quickfill: a station with nothing waiting says so in its own words, a section search with no match offers Clear the search, and an empty dispatch roster links to People → Users.',
    'The schedule and Dispatch mode: an empty day offers Assign work, the Jobs grid offers New Job or clears what hides its rows, a job’s empty week offers Edit job, and an empty Customers list offers Add customer.',
    'Job Tally, workflows, the guides, View as and the map read the same way: Show all cards, Clear the search, + Add, Add Projection and To sort.',
  ],
}

export default note
