import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6774',
  date: '2026-11-09',
  title: 'Send later: the Tell the customer sheet names the exact time a text will go and lets you change it; Today’s sends shows the time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Send in the morning is now Send later. The press reads “Send later · Tomorrow 9:00 AM” and opens When it goes: Now, Tomorrow 9:00 AM, Today 6:00 PM, or a Day and a Time of your own between 8 AM and 9 PM, with the exact time spelled out, like “Goes Tuesday, Nov 10 at 9:00 AM Central, in about 17 hours.”',
    'Today’s sends shows the time on the row, “Goes Tue 9:00 AM”, with Change the time beside it. The Dashboard’s line counts texts that go later.',
    'The app’s run now checks every fifteen minutes, so a text handed to 6:00 PM goes at 6:00 PM. Texts go between 8 AM and 9 PM Central only; one set outside those hours waits for 8 AM and says so.',
  ],
}

export default note
