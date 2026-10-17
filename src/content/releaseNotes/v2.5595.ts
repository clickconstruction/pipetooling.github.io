import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5595',
  date: '2026-10-16',
  title: 'Today’s sends: the app’s reminders become texts the office presses, and a booking can go in the morning',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Settings → Flows: the switch on a reminder the app may send is now three ways. Off does nothing. Offers has the morning run prepare the text and put it on the Dashboard for the office to press. Sends texts it at 9 AM as before.',
    'Today’s sends on the Dashboard’s Needs you: each prepared text with the person, the step and the words. Edit a word, press Send, or Send all that are ready. Not this one, Hold until a day and Stop reminding on this job put one away. A text with no number or a STOP is held and says why.',
    'Send in the morning on the Tell the customer sheet: the booking text waits on Today’s sends and the app sends it at 9 AM on its day. The sheet says when it goes.',
    'The morning run’s line in Flows counts the texts it prepared and a step whose text already waits. The office’s morning texts are sent as the office’s own and land in the thread.',
  ],
}

export default note
