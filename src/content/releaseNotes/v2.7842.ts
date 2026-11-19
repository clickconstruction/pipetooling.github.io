import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7842',
  date: '2026-11-18',
  title: 'Materials on site: a watch tells you',
  kind: 'feature',
  highlights: [
    'A watch now sends a push to the people on its list. Nothing goes to the person watched.',
    'One push when they make their first press of the day, and one for a press outside the process.',
    'Several presses outside the process at once come as one push, and one line in the evening gives the day’s count.',
    'The app checks every five minutes. Press the push to open the site’s materials.',
  ],
}

export default note
