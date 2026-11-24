import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8520',
  date: '2026-11-24',
  title: 'New Job and Edit Job: the address box shows addresses already on file',
  kind: 'feature',
  highlights: [
    'Typing a Job Address now lists the addresses the company already has first, under Already on file. Each row says how many jobs and bids are there, and its development when they share one.',
    'Pressing one takes that exact spelling, and a line under the box then says how many jobs are at this address.',
    'An address typed one letter off from one on file asks once when you leave the box: Use the one on file, or Keep mine. It never stops a save.',
    'A different house number, unit or building is a different place, so the form stays quiet about those.',
  ],
}

export default note
