import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6942',
  date: '2026-11-11',
  title: 'Cards and footers: the designs as code',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The business card and the email footer can now be drawn by the app from a person’s name, title, email, phones and photo. Shapes are drawn and words are real type, in the company’s own typeface.',
    'The look is the one the owner chose: one orange, even lines on the card, a title under the name, and a phone on the footer. Nothing on any screen changes yet. The screens that use it come next.',
  ],
}

export default note
