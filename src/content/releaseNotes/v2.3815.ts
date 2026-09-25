import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3815',
  date: '2026-09-25',
  title: 'Lien desk: see when each window opens, not only when it closes',
  kind: 'feature',
  highlights: [
    'Every date on a job’s lien timeline is a last day. A green line under it now says when that paper could first go out — “open since Aug 1” on a month’s notice, “opens when the notice is mailed” on the lien.',
    'A new Steps · Windows switch in the timeline’s corner. Steps is the timeline as it was; Windows draws each paper as a bar on a calendar from its first day to its last, with the days already gone shaded and today marked.',
    'Your choice is remembered on this device, and Months on this job follows it: “open since Aug 1 · mail by Oct 15 · 21 of 75 days left”, and a missed month shows the dates it was open.',
  ],
}

export default note
