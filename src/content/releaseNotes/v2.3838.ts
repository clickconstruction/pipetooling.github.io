import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3838',
  date: '2026-09-25',
  title: 'Job Summary: sub labor counts on the job its sheet is on',
  kind: 'fix',
  highlights: [
    'Job Summary (and the burn card and budget lines built on it) found a job’s sub-labor sheets by matching the job number typed on the sheet. A job with no HCP number, a job that was renumbered, or a sheet whose number was typed differently showed $0 sub labor — and two jobs sharing a number each got the other’s cost.',
    'Sheets now count on the job they are linked to, the same way the Subs tab and Crew P&L already read them. The Billing tab’s “needs labor” flag follows the same link.',
  ],
}

export default note
