import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8602',
  date: '2026-11-25',
  title: 'People → Hours: someone still on the clock has a green box that opens My Time',
  kind: 'feature',
  highlights: [
    'A person who is still clocked in now shows a green box on that day. It reads the day so far to the minute and says "on the clock". It moves on by itself while the page is open.',
    'The green box is a press, not a field. A press opens that person’s My Time for the day, so hours can no longer be typed by accident under a session that is still running.',
    'The row, day and week totals now count the running time. A total with running time in it is green and names the running part, so it reads apart from a settled one.',
    'A session nobody clocked out of on an earlier day shows an amber box that says "left open". It adds no time, and a press opens My Time, where Force clock out is.',
  ],
}

export default note
