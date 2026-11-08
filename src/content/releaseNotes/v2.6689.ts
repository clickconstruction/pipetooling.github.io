import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6689',
  date: '2026-11-08',
  title: 'The customer’s texts, emails and calls in the Pipeline row’s Job activity box, beside the team’s notes',
  kind: 'feature',
  highlights: [
    'On a wide screen the row’s Job activity box now shows the newest three calls, texts and emails between you and the customer, in time order among the team’s notes. Each wears a small orange tag in place of a number that says how it came: Text, Email, Call, Missed or Voicemail. The notes keep their numbers, so “check note 3” still points at the same note.',
    'A line from the customer carries the orange bar and their name; one from your team carries the sender’s name, or “the app” for one it sent itself. While the customer wrote last and nobody has answered, their newest line says so. Press any line and the speech bubble’s window opens, with the thread and the Text and Email presses.',
    'On a phone the card’s one teaser line is now the newest of the team’s note, the report and the customer’s line. When the customer’s line is newest it reads in orange with its channel word, and a press opens the same window.',
    'Three is the window’s number, so the box and the window show the same lines; older ones are under See all. The office sees the lines; the rest of the team’s view of the box is unchanged.',
  ],
}

export default note
