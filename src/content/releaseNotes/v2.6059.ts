import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6059',
  date: '2026-10-29',
  title: 'Your day stays on the phone when the app is slow',
  kind: 'feature',
  highlights: [
    'My Schedule and the Job Mode card keep the day they last read on your phone. On a slow morning they draw that day at once under a line that reads “Your day as read at 7:52 AM · reading again…”, instead of two grey bars or “Loading Job Mode…”. Once the live read lands the line goes and the day is current.',
    'While the day on screen is the kept one, the presses that write on it wait: Update % done, Leave Report, the rearrange pencil, On my way, Clock out and the rest sit faded and say “reading again…” when you hover. + Add job, the calendar, Materials on site and the Clock In button stay live.',
    'A schedule read that fails no longer lands as an empty day. The kept day stays up and the line reads “could not read again · Retry”; with nothing kept, My Schedule names what went wrong and offers Retry when the signal was the trouble, and never says “Nothing scheduled today”.',
    'Each day is kept under its own date, so yesterday’s day is never shown as today’s, and a kept day is dropped after 24 hours or when you sign out.',
  ],
}

export default note
