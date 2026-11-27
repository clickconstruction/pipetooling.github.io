import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8699',
  date: '2026-11-27',
  title: 'A job’s Lien window says why it stayed open, and a slip beside it no longer closes it',
  kind: 'fix',
  highlights: [
    'Escape leaves a job’s Lien window open when you have typed something and not saved it. It said nothing, so the key read as broken.',
    'Now one line under the title says why the window stayed open, and what closes it.',
    'A press on the dark area around the window used to close it and lose what you typed. It now holds the same way and shows the same line.',
    'The × still closes the window at once, and with nothing typed both Escape and the dark area close it as before.',
  ],
}

export default note
