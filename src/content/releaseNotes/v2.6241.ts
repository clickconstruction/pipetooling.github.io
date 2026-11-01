import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6241',
  date: '2026-10-31',
  title: 'A dev’s agent files plan sets into the PipeTooling Jobs Shared Drive',
  kind: 'fix',
  highlights: [
    'When a dev’s agent files a plan set for the robots, the file now goes into the PipeTooling Jobs Shared Drive, under Bid plans, then the division, then the project.',
    'The office’s plumbing, electrical and HVAC bid folders only need View access for the intake account. It no longer writes there.',
    'The bid’s plans link points at the new folder, so the Bid Board opens the set in one tap, as before.',
  ],
  roles: ['dev'],
}

export default note
