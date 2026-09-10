import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3247',
  date: '2026-09-10',
  title: 'Customer Waiting, part 2: the red row, tap-to-call, lower and raise priority',
  kind: 'feature',
  highlights: [
    'A request a customer sent from their portal now sits at the top of the Dispatch (or Estimator) inbox as a "Customer waiting" row: red rail, a wait that ticks, their name, the request in their own words, when they can be there, and one big Call button with their number. Text works too.',
    'Calling stamps the request — "Sam called 2:14 pm" in the row footer — so the rest of the team can see someone is on it. On a desktop, where dialing does nothing, the button copies the number instead.',
    'Lower priority ▾ takes it off the top without closing it and asks why in one tap (Scheduled · Not urgent · Spam or duplicate · Other); the reason goes into the thread. Raise priority on any open request does the reverse.',
    'The Dispatch Mode Inbox badge breathes while a customer is waiting. Help: "answer a customer who sent a request from their portal".',
  ],
}

export default note
