import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5078',
  date: '2026-10-09',
  title: 'GC mode: see who to call about the schedule',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a job being built, group a GC project’s schedule by company to see everyone whose answer moves the chart. Every reason to call sits under their name, late first.',
    'Call dials them. A line about a bar opens it, and Their work shows only that company’s bars.',
    'A bar’s card names the company doing the work, with Call.',
  ],
}

export default note
