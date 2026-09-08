import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3156',
  date: '2026-09-08',
  title: 'The People board, built for a phone',
  kind: 'feature',
  highlights: [
    'On a phone, Schedule Dispatch → People shows one day at a time, full width, with a day strip to hop between days. Each tech is a card: their name, their blocks for the day, and a full-width "+ Add here" — no more hunting for a sliver of cell.',
    'While you are adding a job or copying one to another tech, every tech card becomes the button and says what will land ("Tap to add J927 · 12–4 here"). The instruction sits in a bar just above the tab bar, with Cancel right beside it.',
    'Tap any block for its sheet: Edit, Copy to techs, Remove. Copy to techs is a checklist of people with their day at a glance — pick several, keep them linked, one button.',
    'Prefer the full week? "Show the desktop view" at the very bottom of the page brings the week grid back, exactly as on a computer, and the phone remembers your choice.',
  ],
}

export default note
