import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6941',
  date: '2026-11-11',
  title: 'Cards and footers: a place for a person’s photo and the name on their card',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app will soon draw a person’s business card and email footer from their own facts, instead of a picture a designer made by hand. This is the ground under it: a place on each account for the name on the card and for a photo, and a private home for the photo itself.',
    'A person can add their own photo, and the office can add one for a teammate. Nobody else can see it. Nothing on any screen changes yet.',
  ],
}

export default note
