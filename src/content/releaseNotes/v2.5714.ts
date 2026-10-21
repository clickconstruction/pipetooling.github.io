import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5714',
  date: '2026-10-21',
  title: 'Messages: Nudge writes the reminder for you',
  kind: 'feature',
  highlights: [
    'Nudge on Waiting on them opens the thread with the reminder for their step already written and the send window open. Read it and press Send.',
    'The words are the ones the morning run would send: your quick reply for the step first, else the step’s own line. A person on no step gets a plain check in.',
    'Text Greg on Nudges from the flow does the same. A text that cannot go, no number or STOP, opens as an email instead.',
    'When our last text never reached their phone, the row turns red and offers Call them and Send it as an email in Nudge’s place.',
  ],
}

export default note
