import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2918',
  date: '2026-09-05',
  title: 'Field papercuts — "Ask estimating" in the header, standing guidance when nothing is scheduled, "You are here" in Update Focus',
  kind: 'fix',
  highlights: [
    'The purple header button now says "Ask estimating" (hover and screen readers) on phones and desktops alike — it sends a request to estimating; it was never an inbox.',
    'Clock In with no jobs on your schedule: the sheet now says so and keeps saying so — "Nothing on your schedule today, and no jobs assigned to you" with a tap-to-call dispatch number and a pointer to the search box — instead of a toast that disappeared before you could read it.',
    'Update Focus and the clock-out review list the job you are clocked into first with a green "You are here" tag, and the selected pick is blue instead of grey, so it no longer looks disabled.',
  ],
}

export default note
