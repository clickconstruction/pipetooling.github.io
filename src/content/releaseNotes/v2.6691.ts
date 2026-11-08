import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6691',
  date: '2026-11-08',
  title: 'Answer the customer and tie their line from Job activity itself',
  kind: 'feature',
  highlights: [
    'A line from the customer in a job’s activity now has a Reply press at its right, inside the opened line on a phone. Press it and the customer’s box opens where the note bar was, tied to this job, under a head naming the line, like “Replying to Dana’s text · 9:05a”. A text, a call or a voicemail is answered by text and an email by email; the stage’s quick replies come first; the new line lands at the bottom of the feed in orange. The ✕ on the head goes back to the note bar, and a note stays a note the customer never sees.',
    'A customer’s line that sits on no job yet shows Tie to this job and Another job… in place of “not tied yet”. Tie to this job ties it here and puts the job on the customer’s list in Messages, with Undo on the message that confirms it. Another job… opens the job picker.',
    'The office sees both. A tech reads the feed as before, the word “not tied yet” included.',
  ],
}

export default note
