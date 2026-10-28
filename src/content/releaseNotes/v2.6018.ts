import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6018',
  date: '2026-10-28',
  title: 'Settings → Phone and texts → Missed calls: the switch, the three lines and the last texts back',
  kind: 'feature',
  highlights: [
    'A new Missed calls card sits under Office hours. The owner or a dev turns the text back on after a confirm, and writes the three lines the app sends: in office hours, after hours, and with a voicemail. Everyone else on the page reads them.',
    'The card says in plain words what holds a text back: Send texts off, a number that sent STOP, a prospect who has not said yes, our own numbers, a text of ours in the last three hours.',
    'Last texts back lists the last ten missed calls with what the app did: sent and which line, or not sent and why.',
    'The Finish switching Messages on card counts it as the ninth switch, Settings search and the dev doors know the card, and the guide “text back a missed call” walks it.',
  ],
}

export default note
