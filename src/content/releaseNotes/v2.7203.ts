import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7203',
  date: '2026-11-13',
  title: 'New task on a phone: Done when… and Pick a day fit one screen',
  kind: 'fix',
  highlights: [
    'The note under the Done when… box is one line now. It was five lines on a phone and pushed the window past one screen.',
    'On a phone, Pick a day shows the date box and no four-week calendar, so Where and Add stay on screen. The phone\'s own calendar opens from the date.',
    'A task that repeats still draws the four weeks, on a phone and at a desk. At a desk nothing changes.',
  ],
}

export default note
