import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4296',
  date: '2026-10-01',
  title: 'Lien waivers: the window shows how the amount is figured',
  kind: 'feature',
  highlights: [
    'When a waiver’s amount is less than the bill, the Release of Lien window shows the math under the Amount box: the bill, each payment on it with its date, and the total. Each bill chip now says what is still owed. On a reopened draft, clicking a chip or switching the form now updates the amount, the through date and the page — before, they stayed as they were.',
    'If another live waiver already covers the bill, the window says so in plain words, with Open the signed one and Discard this draft, so the same money is never waived twice.',
    'Money already paid that no unconditional waiver covers gets one button, Waive the paid amount, which switches the window to the unconditional progress form.',
    'Typing over the amount shows what the bills say, with one button to put it back. Hovering the math marks the amount on the page preview.',
  ],
}

export default note
