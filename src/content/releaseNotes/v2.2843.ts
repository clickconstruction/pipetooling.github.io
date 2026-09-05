import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2843',
  date: '2026-09-05',
  title: 'Sub sheet stages: cleaner Activity lines, and the fourth dot lights when pay is queued',
  kind: 'fix',
  highlights: [
    "Stage moves on the job's Activity feed now start with the sub's name instead of repeating the Sub labor tag.",
    "On the sub's portal, a sheet at Waiting on customer with a payable-after date lights the You're paid dot and shows a green Queued for Friday chip, so the sub can see the calendar is all that's left.",
  ],
}

export default note
