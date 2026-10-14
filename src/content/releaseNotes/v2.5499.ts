import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5499',
  date: '2026-10-13',
  title: 'Messages: a tech’s text from Job Mode goes out through the company number, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for Message the customer on Job Mode. It stays switched off for now.',
    'The app writes the text itself from the line the tech pressed and the job’s record. The tech types only what the app cannot know.',
    'Only a tech on the job, or the office, can send it. The customer’s answer goes to that tech until their hour.',
    'The text is tied to the job and keeps the line it came from.',
  ],
}

export default note
