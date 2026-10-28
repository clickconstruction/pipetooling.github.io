import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6012',
  date: '2026-10-28',
  title: 'A missed call gets a text back from the app',
  kind: 'feature',
  highlights: [
    'When nobody picks up a call to the company number, the app texts the caller back from that number with the office’s words: one line in office hours, one after hours, and a third when they left a voicemail. It goes out within a minute of the call, and a caller who rings again inside three hours gets nothing more.',
    'Every gate the app’s texts already have holds: the Send texts switch, a number that sent STOP, a prospect who has not said we may text, our own numbers, the phone balance and the carriers’ daily cap. Nothing goes while any of them says no, and the reason is kept for the Missed calls card.',
    'The text is marked as the app’s on the thread, “The app texted back · from the company number”, and it never clears Needs a reply or starts Waiting on them. The New lane’s row says the app texted back and still waits on you; the office’s reply push for the call still goes.',
    'It ships off. Settings → Phone and texts → Missed calls, the switch and the three lines, comes in the next release; until then a dev turns it on.',
  ],
}

export default note
