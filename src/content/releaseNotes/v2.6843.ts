import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6843',
  date: '2026-11-10',
  title: 'Permits: a second look at what someone else passed',
  kind: 'feature',
  highlights: [
    'When someone else has passed permits, a grey count such as “12 passed” sits beside Skim on the Permits strip. Press it for a second look: one card at a time, best first. The card says who passed, when, and why.',
    'Keep moves the permit to Kept under your name. Pass agrees with the first pass. Undo and the swipe work the same as on Skim.',
    'Each permit gets one second look. After two people pass it, it leaves the deck for everyone, and your own passes never show in yours.',
    'When Skim is caught up it offers the Second look too, and the month\u2019s count says which passes were second looks.',
  ],
}

export default note
