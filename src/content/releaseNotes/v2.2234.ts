import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2234',
  date: '2026-08-24',
  title: 'Sub labor job search finds paid-in-full jobs',
  kind: 'fix',
  highlights: [
    'Assigning or editing sub labor could come up "No jobs match" for jobs already paid in full — the search only knew those jobs if the Pipeline\'s Paid in Full section had been expanded first.',
    'Opening the sub labor form now loads paid jobs too; they show up in the job search under the Finished jobs divider, marked with their Paid chip.',
    'While they load, the search says so instead of pretending the job doesn\'t exist.',
  ],
}

export default note
