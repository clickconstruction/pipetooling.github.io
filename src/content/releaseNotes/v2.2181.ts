import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2181',
  date: '2026-08-23',
  kind: 'fix',
  title: 'Primaries get Documents back — for their own jobs',
  highlights: [
    'The Documents page is available to primaries again (it had been hidden since July); it shows the jobs, estimates, and bid proposals they are attached to.',
    'Fix: Documents → Jobs had been showing "No jobs in this ledger" for everyone since late August — the list is back.',
  ],
}

export default note
